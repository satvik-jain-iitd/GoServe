-- Story #484 (epic E25). One append-only log that answers "what happened to order X": time, order, actor (app, sw, n8n, sim), event, result, detail.
-- Nobody reads or writes the table directly except the service role (n8n and the owner's script). The phone and the service worker write through two
-- functions that fix the actor themselves, cut the text, and stop at 200 lines per order. No keys, tokens, phone numbers or push addresses are stored:
-- the service worker line keeps only the push service host.

create table order_trace (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  order_id uuid,                       -- null when the line has no order (an unknown push address)
  actor text not null check (actor in ('app', 'sw', 'n8n', 'sim')),
  event text not null check (length(event) between 1 and 60),
  result text check (length(result) <= 60),
  detail jsonb
);
create index order_trace_order on order_trace (order_id, at);
alter table order_trace enable row level security;
revoke all on order_trace from public, anon, authenticated;

create function trace_write(p_order uuid, p_actor text, p_event text, p_result text, p_text text, p_host text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_order is not null and (select count(*) from order_trace where order_id = p_order) >= 200 then
    return;
  end if;
  insert into order_trace (order_id, actor, event, result, detail)
  values (p_order, p_actor, left(coalesce(nullif(trim(p_event), ''), 'unknown'), 60), left(p_result, 60),
          jsonb_strip_nulls(jsonb_build_object('text', nullif(left(p_text, 300), ''), 'host', p_host)));
end $$;
revoke all on function trace_write(uuid, text, text, text, text, text) from public, anon, authenticated;

-- The customer app: a line for the caller's own order. Another person's order id writes nothing.
create function trace_app(p_order uuid, p_event text, p_result text default null, p_text text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_order is not null and not exists (select 1 from orders where id = p_order and session_id = auth.uid()::text) then return; end if;
  perform trace_write(p_order, 'app', p_event, p_result, p_text, null);
end $$;
revoke all on function trace_app(uuid, text, text, text) from public, anon;
grant execute on function trace_app(uuid, text, text, text) to authenticated;

-- The service worker has no login, only its push address. The line goes to the newest order of that address's owner; an unknown address gets no order.
create function trace_sw(p_endpoint text, p_event text, p_result text default null, p_text text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid;
begin
  select o.id into v_order from push_subscriptions s join orders o on o.session_id = s.session_id where s.endpoint = p_endpoint order by o.created_at desc limit 1;
  perform trace_write(v_order, 'sw', p_event, p_result, p_text, substring(p_endpoint from '^https://([^/?#]+)'));
end $$;
revoke all on function trace_sw(text, text, text, text) from public;
grant execute on function trace_sw(text, text, text, text) to anon, authenticated;
