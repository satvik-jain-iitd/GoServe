-- Story #1329 (epic: top 3 for prod): the early-friend offer is an admin setting, on or off, with its amount. Owner, 10 Nov 2026: "I do not want to give the early bird offer now."
-- 1) settings row early_friend {"on": false, "amount_paise": 10000}. Default OFF. The amount is between 1000 and 50000 paise (Rs 10 to Rs 500).
-- 2) early_friend_get_v2 / early_friend_set_v2: admin only; every real change is logged in early_friend_log (who, when, on, amount). The same value twice logs nothing.
-- 3) area_request_add_v2 reads the setting. Off: the request is saved and no promise is written or shown. On: as before, with the amount from the setting.
-- 4) Old promises are dropped (owner, 10 Nov 2026: the app is in a closed test with friends only, nobody was promised anything, nobody pays). This migration clears every
--    stored promise that is not yet spent, and so does turning the offer off. Turning it on later never brings an old promise back; a promise is written only while the
--    offer is on. A cancelled first order gives its promise back only while the offer is on.
-- Nothing else changes: early_friend_for and place_order_v2 read the stored promise, so the quote, the bill and the order agree with it.

alter table settings add constraint settings_early_friend_rule check (name <> 'early_friend' or
  case when jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'on') = 'boolean' and jsonb_typeof(value -> 'amount_paise') = 'number'
       then (value ->> 'amount_paise')::numeric = trunc((value ->> 'amount_paise')::numeric) and (value ->> 'amount_paise')::numeric between 1000 and 50000
       else false end);
insert into settings (name, value) values ('early_friend', '{"on": false, "amount_paise": 10000}'::jsonb) on conflict (name) do nothing;

-- 4) the one-time clear of what was promised before this switch existed
update area_requests set offer_paise = null, offered_at = null where offer_order_id is null and offer_paise is not null;

create table early_friend_log (
  id uuid primary key default gen_random_uuid(),
  on_ boolean not null,
  amount_paise integer not null,
  by_user uuid default auth.uid(),
  by_label text,
  at timestamptz not null default now()
);
alter table early_friend_log enable row level security;
create policy early_friend_log_admin_read on early_friend_log for select to authenticated using (is_admin());
revoke all on early_friend_log from public, anon, authenticated;
grant select on early_friend_log to authenticated;

create function early_friend_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('on', (s.value ->> 'on')::boolean, 'amount_paise', (s.value ->> 'amount_paise')::integer, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'early_friend');
end $$;

create function early_friend_set_v2(p_on boolean, p_amount_paise integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cur jsonb; v_new jsonb;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_on is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request', 'message', 'Say on or off.');
  end if;
  if p_amount_paise is null or p_amount_paise < 1000 or p_amount_paise > 50000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount', 'message', 'Pick an amount from Rs 10 to Rs 500.');
  end if;
  select value into v_cur from settings where name = 'early_friend' for update;
  v_new := jsonb_build_object('on', p_on, 'amount_paise', p_amount_paise);
  if v_new = v_cur then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  update settings set value = v_new, updated_by = auth.uid(), updated_at = now() where name = 'early_friend';
  if not p_on then   -- off drops every promise not yet spent, so turning it on later brings none back
    update area_requests set offer_paise = null, offered_at = null where offer_order_id is null and offer_paise is not null;
  end if;
  insert into early_friend_log (on_, amount_paise, by_label) values (p_on, p_amount_paise, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'changed', true);
end $$;
revoke all on function early_friend_get_v2() from public, anon;
revoke all on function early_friend_set_v2(boolean, integer) from public, anon;
grant execute on function early_friend_get_v2() to authenticated;
grant execute on function early_friend_set_v2(boolean, integer) to authenticated;

create or replace function area_request_add_v2(p_pin text, p_lat double precision default null, p_lng double precision default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_on boolean; v_amount integer; v_row area_requests;
begin
  if auth.uid() is null then raise exception 'invalid_request'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_pin', 'message', 'That pin code is not valid.');
  end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180) then
    return jsonb_build_object('ok', false, 'error', 'invalid_place', 'message', 'That place is not valid.');
  end if;
  select coalesce((value ->> 'on')::boolean, false), coalesce((value ->> 'amount_paise')::integer, 10000) into v_on, v_amount from settings where name = 'early_friend';
  insert into area_requests (user_id, pin, lat, lng, phone, offer_paise, offered_at)
  values (auth.uid(), p_pin, p_lat, p_lng, (select c.phone from customers c where c.user_id = auth.uid()), case when v_on then v_amount end, case when v_on then now() end)
  on conflict (user_id, pin) do update set
    offer_paise = case when v_on then coalesce(area_requests.offer_paise, v_amount) end,
    offered_at = case when v_on then coalesce(area_requests.offered_at, now()) end
  returning * into v_row;
  -- the promise shown is the one the row holds and has not spent, and only while the offer is on
  return jsonb_build_object('ok', true, 'offer_paise', case when v_on and v_row.offer_paise > 0 and v_row.offer_order_id is null then v_row.offer_paise end);
end $$;

-- release_early_friend of 20261109130000: a cancelled first order gives its promise back only while the offer is on.
create or replace function release_early_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select (value ->> 'on')::boolean from settings where name = 'early_friend'), false) then
    update area_requests set offer_order_id = null where offer_order_id = new.id;
  end if;
  return new;
end $$;
