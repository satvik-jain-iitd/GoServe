-- Story #718 (#619 layer d, board L1). "Tell me when it opens": a customer who finds a kitchen closed asks once; when the kitchen opens, one push says so.
-- The ask is a row in open_alerts. The sender's own take call (push_outbox_take, every 30 s) first sweeps the asks: every kitchen that is open now turns its asks
-- into push_outbox rows of kind kitchen_open (no order), and the asks are forgotten. The phone then asks push_latest what to show; an unshown kitchen_open row wins once.
-- ORDER OF ROLLOUT: n8n MAIN 34 (it passes kind on) is deployed before this migration reaches a database it drains.

alter table push_outbox alter column order_id drop not null;
alter table push_outbox add column kind text not null default 'order' check (kind in ('order', 'kitchen_open')),
  add column kitchen_id uuid references kitchens (id) on delete cascade, add column shown_at timestamptz;

create table open_alerts (
  session_id text not null,
  kitchen_id uuid not null references kitchens (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, kitchen_id)
);
alter table open_alerts enable row level security;
revoke all on open_alerts from public, anon, authenticated;

create function open_alert_add_v2(p_kitchen uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'invalid_request'; end if;
  if not exists (select 1 from kitchens where id = p_kitchen) then
    return jsonb_build_object('error', 'not_found', 'message', 'This kitchen is not on GoServe.');
  end if;
  if not exists (select 1 from push_subscriptions where session_id = auth.uid()::text) then
    return jsonb_build_object('error', 'no_push', 'message', 'Allow alerts first.');
  end if;
  insert into open_alerts (session_id, kitchen_id) values (auth.uid()::text, p_kitchen) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function open_alert_add_v2(uuid) from public, anon;
grant execute on function open_alert_add_v2(uuid) to authenticated;

-- For the sender only: asks of kitchens that are open now become push rows. An ask older than 3 days is dropped (the customer has moved on).
create function open_alerts_sweep() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_n integer;
begin
  delete from open_alerts where created_at < now() - interval '3 days';
  with due as (
    delete from open_alerts a using kitchens k
    where k.id = a.kitchen_id and kitchen_open_now(k.open, k.active, k.opens_at, k.closes_at, now())
    returning a.session_id, a.kitchen_id)
  insert into push_outbox (session_id, status, kind, kitchen_id) select session_id, 'open', 'kitchen_open', kitchen_id from due;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function open_alerts_sweep() from public, anon, authenticated;
grant execute on function open_alerts_sweep() to service_role;

create or replace function push_outbox_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  r record;
begin
  perform open_alerts_sweep();
  delete from push_outbox where created_at < now() - interval '2 days';
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

-- What the notification says. A kitchen_open row of the last 15 minutes that was not shown yet wins, once; otherwise the newest order, as before.
-- Volatile now (it marks the row shown).
create or replace function push_latest(p_endpoint text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_session text;
  v_status text;
  v_rider text;
  v_row push_outbox;
  v_kitchen text;
begin
  select session_id into v_session from push_subscriptions where endpoint = p_endpoint;
  if v_session is null then
    return null;
  end if;
  select * into v_row from push_outbox where session_id = v_session and kind = 'kitchen_open' and shown_at is null and created_at > now() - interval '15 minutes'
    order by id desc limit 1;
  if found then
    update push_outbox set shown_at = now() where id = v_row.id;
    select name into v_kitchen from kitchens where id = v_row.kitchen_id;
    return jsonb_build_object('title', 'GoServe', 'status', 'open', 'body', coalesce(v_kitchen, 'The kitchen') || ' is open. Order now.');
  end if;
  select o.status, r.name into v_status, v_rider from orders o left join riders r on r.user_id = o.rider_id where o.session_id = v_session order by o.created_at desc limit 1;
  if v_status is null then
    return null;
  end if;
  return jsonb_build_object('title', 'GoServe', 'status', v_status, 'body', case v_status
    when 'placed' then 'Your order is placed.'
    when 'accepted' then 'The kitchen accepted your order.'
    when 'preparing' then 'Your order is being cooked.'
    when 'ready' then 'Your order is ready.'
    when 'out_for_delivery' then case when coalesce(trim(v_rider), '') <> '' then trim(v_rider) || ' has picked up your order.' else 'Your order is on the way.' end
    when 'delivered' then 'Your order was delivered.'
    when 'cancelled' then 'Your order was cancelled.'
    else 'Your order has an update.' end);
end $$;
