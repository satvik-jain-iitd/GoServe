-- Story 1754 (epic 1753; owner, 21 Nov 2026: "Delivery fees change krne ka option admin app me add kro, abhi 20rs karna hai").
-- The delivery fee is one number the admin owns. Every change keeps who and when.
-- 1) settings row delivery_fee {"amount_paise": N}: whole rupees, Rs 0 to Rs 200. Prod starts at 0 (the owner types 20 himself). Dev starts at
--    Rs 20 with one log row "dev seed" (story 797: dev carries every switch prod carries): dev is the database whose settings row clear_allowed
--    is true (set by hand on dev, never on prod; same test as 20261114100000_rider_incentive.sql).
-- 2) delivery_fee_log: one row per real change (amount, who, when). Closed to every role; only the two functions below write it.
-- 3) delivery_fee_get_v1 / delivery_fee_set_v1: admin only (the admin check comes first, then the amount).
-- Safe to run twice: every object is guarded.
alter table settings drop constraint if exists settings_delivery_fee_rule;
alter table settings add constraint settings_delivery_fee_rule check (name <> 'delivery_fee' or
  case when jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'amount_paise') = 'number'
       then (value ->> 'amount_paise')::numeric between 0 and 20000 and (value ->> 'amount_paise')::numeric % 100 = 0
       else false end);
create table if not exists delivery_fee_log (
  id uuid primary key default gen_random_uuid(),
  amount_paise integer not null,
  by_user uuid default auth.uid(),
  by_label text,
  at timestamptz not null default now()
);
alter table delivery_fee_log enable row level security;
revoke all on delivery_fee_log from public, anon, authenticated;

do $$
declare v_dev boolean := coalesce((select (value #>> '{}')::boolean from settings where name = 'clear_allowed'), false);
begin
  if not exists (select 1 from settings where name = 'delivery_fee') then
    insert into settings (name, value) values ('delivery_fee', jsonb_build_object('amount_paise', case when v_dev then 2000 else 0 end));
    if v_dev then insert into delivery_fee_log (amount_paise, by_label) values (2000, 'dev seed'); end if;
  end if;
end $$;

create or replace function delivery_fee_get_v1() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('amount_paise', (s.value ->> 'amount_paise')::integer, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'delivery_fee');
end $$;

create or replace function delivery_fee_set_v1(p_amount_paise integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cur jsonb; v_new jsonb;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_amount_paise is null or p_amount_paise < 0 or p_amount_paise > 20000 or p_amount_paise % 100 <> 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount', 'message', 'Type 0 to 200 rupees.');
  end if;
  select value into v_cur from settings where name = 'delivery_fee' for update;
  v_new := jsonb_build_object('amount_paise', p_amount_paise);
  if v_new = v_cur then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  update settings set value = v_new, updated_by = auth.uid(), updated_at = now() where name = 'delivery_fee';
  insert into delivery_fee_log (amount_paise, by_label) values (p_amount_paise, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'changed', true);
end $$;
revoke all on function delivery_fee_get_v1() from public, anon;
revoke all on function delivery_fee_set_v1(integer) from public, anon;
grant execute on function delivery_fee_get_v1() to authenticated;
grant execute on function delivery_fee_set_v1(integer) to authenticated;
