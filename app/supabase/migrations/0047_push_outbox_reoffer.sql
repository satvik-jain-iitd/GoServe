-- Story #534 (epic E25, follows #483). A push taken from the queue but never sent must not be lost.
-- Rule (reviewer, 27 Oct): a row taken and not marked sent within 2 minutes goes back to the queue, at most 3 times; then it is dead-lettered with a trace row.
-- The sender (n8n MAIN 34) marks the rows it sent with push_outbox_sent. ORDER OF ROLLOUT: MAIN 34 must call push_outbox_sent BEFORE this migration
-- reaches a database it drains, or every sent row is offered again (a duplicate push, three times).

alter table push_outbox add column sent_at timestamptz, add column reoffers integer not null default 0, add column dead_at timestamptz;

create or replace function push_outbox_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  r record;
begin
  delete from push_outbox where created_at < now() - interval '2 days';
  -- give up: taken long ago, never marked sent, already offered again 3 times
  for r in update push_outbox set dead_at = now() where taken_at < now() - interval '2 minutes' and sent_at is null and dead_at is null and reoffers >= 3
           returning order_id, status loop
    perform trace_write(r.order_id, 'db', 'push_dead', r.status, 'not sent after 3 re-offers', null);
  end loop;
  with t as (select id from push_outbox
             where sent_at is null and dead_at is null and (taken_at is null or taken_at < now() - interval '2 minutes')
             order by id limit greatest(1, least(p_limit, 100)) for update skip locked),
  u as (update push_outbox o set reoffers = o.reoffers + (o.taken_at is not null)::int, taken_at = now() from t where o.id = t.id
        returning o.id, o.order_id, o.session_id, o.status)
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb) into v_rows from u;
  return jsonb_build_object('rows', v_rows);
end $$;

-- For n8n (service role only): the rows SUB 20 finished with.
create function push_outbox_sent(p_ids bigint[]) returns integer
language sql security definer set search_path = public as $$
  with u as (update push_outbox set sent_at = now() where id = any (p_ids) and sent_at is null returning 1) select count(*)::int from u;
$$;
revoke all on function push_outbox_sent(bigint[]) from public, anon, authenticated;
grant execute on function push_outbox_sent(bigint[]) to service_role;
