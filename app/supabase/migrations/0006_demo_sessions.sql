-- Story #52. Two devices share one demo session, and a device can reset its session (ADR-011).
-- A device reads its own session (ADR-010) and any session it joined by link. It never writes orders itself.

create table session_links (
  member uuid not null,       -- the joining device's anonymous user id
  session_id text not null,   -- the session it joined
  created_at timestamptz not null default now(),
  primary key (member, session_id)
);
alter table session_links enable row level security;   -- no policy: only the functions below touch it

-- True for the caller's own session and for sessions it joined. Security definer so the read rules can look inside session_links.
create function is_my_session(p_session text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_session = auth.uid()::text
      or exists (select 1 from session_links where member = auth.uid() and session_id = p_session)
$$;
revoke execute on function is_my_session(text) from public, anon;
grant execute on function is_my_session(text) to authenticated;

drop policy orders_own_session on orders;
create policy orders_own_session on orders for select to authenticated using (is_my_session(session_id));
drop policy events_own_session on order_events;
create policy events_own_session on order_events for select to authenticated using (is_my_session(session_id));

-- Join a session by its id (the id is in the link and cannot be guessed). Only a session that exists can be joined.
create function join_session(p_session text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'no_session';
  end if;
  if not exists (select 1 from auth.users where id::text = p_session) then
    raise exception 'session_not_found';
  end if;
  insert into session_links (member, session_id) values (auth.uid(), p_session) on conflict do nothing;
end $$;
revoke execute on function join_session(text) from public, anon;
grant execute on function join_session(text) to authenticated;

-- order_events stay frozen, except while reset_session deletes one session's history.
create or replace function order_events_frozen() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('goserve.reset', true) = 'on' then
    return old;
  end if;
  raise exception 'order_events cannot be changed';
end $$;

-- Clears one session: its orders, their events and decisions. run_log stays (it is the operations history).
create function reset_session(p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_orders integer;
begin
  if not is_my_session(p_session) then
    raise exception 'not_your_session';
  end if;
  perform set_config('goserve.reset', 'on', true);   -- true = for this transaction only
  delete from order_events where session_id = p_session;
  delete from decision_log where session_id = p_session;
  delete from orders where session_id = p_session;
  get diagnostics v_orders = row_count;
  return jsonb_build_object('orders', v_orders);
end $$;
revoke execute on function reset_session(text) from public, anon;
grant execute on function reset_session(text) to authenticated;
