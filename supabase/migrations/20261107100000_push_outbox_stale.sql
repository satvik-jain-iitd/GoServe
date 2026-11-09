-- Story #920 (1 of 3). A restart never fires old pushes: push_outbox_take marks every row older than 10 minutes dead as 'stale' (reoffers unchanged) before it hands anything out.
-- Everything else stays as it was in 0050.

create or replace function push_outbox_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  r record;
begin
  perform open_alerts_sweep();
  delete from push_outbox where created_at < now() - interval '2 days';
  for r in update push_outbox set dead_at = now() where created_at < now() - interval '10 minutes' and sent_at is null and dead_at is null
           returning order_id, status loop
    if r.order_id is not null then perform trace_write(r.order_id, 'db', 'push_dead', r.status, 'stale', null); end if;
  end loop;
  for r in update push_outbox set dead_at = now() where taken_at < now() - interval '2 minutes' and sent_at is null and dead_at is null and reoffers >= 3
           returning order_id, status loop
    if r.order_id is not null then perform trace_write(r.order_id, 'db', 'push_dead', r.status, 'not sent after 3 re-offers', null); end if;
  end loop;
  with t as (select id from push_outbox
             where sent_at is null and dead_at is null and (taken_at is null or taken_at < now() - interval '2 minutes')
             order by id limit greatest(1, least(p_limit, 100)) for update skip locked),
  u as (update push_outbox o set reoffers = o.reoffers + (o.taken_at is not null)::int, taken_at = now() from t where o.id = t.id
        returning o.id, o.order_id, o.session_id, o.status, o.kind, o.kitchen_id)
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into v_rows from u;
  return jsonb_build_object('rows', v_rows);
end $$;
