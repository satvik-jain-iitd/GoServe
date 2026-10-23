-- Story A7 (#154, epic E12). Web push: a customer's phone subscribes once; n8n sends a push with no text; the phone's service worker asks push_latest what to say.
-- The subscription is a secret of the device (the endpoint is an unguessable address), so a person can read only their own rows, and push_latest answers only for an endpoint that exists.

create table push_subscriptions (
  id bigint generated always as identity primary key,
  session_id text not null,      -- the customer's user id: the session id of their orders
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy push_own on push_subscriptions for select to authenticated using (session_id = auth.uid()::text);
create policy push_delete_own on push_subscriptions for delete to authenticated using (session_id = auth.uid()::text);

-- Save (or move to this user) the subscription of this device. A device that signs in with Google keeps the same user id (ADR-016); if the id changes the row follows.
create function save_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(trim(p_endpoint), '') = '' or coalesce(trim(p_p256dh), '') = '' or coalesce(trim(p_auth), '') = '' then
    raise exception 'invalid_request';
  end if;
  insert into push_subscriptions (session_id, endpoint, p256dh, auth) values (auth.uid()::text, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set session_id = excluded.session_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
revoke execute on function save_push(text, text, text) from public, anon;
grant execute on function save_push(text, text, text) to authenticated;

-- What the notification says: the newest order of the subscription's owner. The phone's service worker calls this with the public key (no login in a worker).
create function push_latest(p_endpoint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_session text;
  v_status text;
begin
  select session_id into v_session from push_subscriptions where endpoint = p_endpoint;
  if v_session is null then
    return null;
  end if;
  select status into v_status from orders where session_id = v_session order by created_at desc limit 1;
  if v_status is null then
    return null;
  end if;
  return jsonb_build_object('title', 'GoServe', 'status', v_status, 'body', case v_status
    when 'placed' then 'Your order is placed.'
    when 'accepted' then 'The kitchen accepted your order.'
    when 'preparing' then 'Your order is being cooked.'
    when 'ready' then 'Your order is ready.'
    when 'out_for_delivery' then 'Your order is on the way.'
    when 'delivered' then 'Your order was delivered.'
    when 'cancelled' then 'Your order was cancelled.'
    else 'Your order has an update.' end);
end $$;
revoke execute on function push_latest(text) from public;
grant execute on function push_latest(text) to anon, authenticated;

-- For n8n (service role only): who to push for a session, and forget an endpoint the push service says is gone (404 or 410).
create function push_targets(p_session text) returns jsonb
language sql stable as $$
  select jsonb_build_object('targets', coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint)), '[]'::jsonb)) from push_subscriptions where session_id = p_session
$$;
create function push_forget(p_endpoint text) returns void
language sql as $$
  delete from push_subscriptions where endpoint = p_endpoint
$$;
revoke execute on function push_targets(text) from public, anon, authenticated;
revoke execute on function push_forget(text) from public, anon, authenticated;
grant execute on function push_targets(text) to service_role;
grant execute on function push_forget(text) to service_role;
