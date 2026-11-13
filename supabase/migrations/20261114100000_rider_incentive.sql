-- Stories 1443 and 1438 (boards TI1 and AR1; owner, 13 Nov 2026: "incentive wala daalo pr admin settings me bhi jaana chahiye enable disable and adjust krne ka").
-- An amount for each delivery, paid with the salary. Never part of the cash the rider holds.
-- 1) settings row rider_incentive {"on": false, "amount_paise": 1000}. Prod starts OFF. The amount is Rs 5 to Rs 100 in steps of Rs 5.
-- 2) rider_incentive_get_v2 / rider_incentive_set_v2: admin only. Every real change is a row in rider_incentive_log (who, when, on, amount),
--    so a past delivery keeps the amount of its own moment.
-- 3) rider_incentive_rates: a rider (or an admin) reads the switch now and the changes of the last 35 days, plus the last change before them.
--    The app counts each delivery at the rate in force when it was delivered. Before the first change the incentive is off.
alter table settings add constraint settings_rider_incentive_rule check (name <> 'rider_incentive' or
  case when jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'on') = 'boolean' and jsonb_typeof(value -> 'amount_paise') = 'number'
       then (value ->> 'amount_paise')::numeric between 500 and 10000 and (value ->> 'amount_paise')::numeric % 500 = 0
       else false end);
insert into settings (name, value) values ('rider_incentive', '{"on": false, "amount_paise": 1000}'::jsonb) on conflict (name) do nothing;

create table rider_incentive_log (
  id uuid primary key default gen_random_uuid(),
  on_ boolean not null,
  amount_paise integer not null,
  by_user uuid default auth.uid(),
  by_label text,
  at timestamptz not null default now()
);
alter table rider_incentive_log enable row level security;
revoke all on rider_incentive_log from public, anon, authenticated;

create function rider_incentive_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('on', (s.value ->> 'on')::boolean, 'amount_paise', (s.value ->> 'amount_paise')::integer, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'rider_incentive');
end $$;

create function rider_incentive_set_v2(p_on boolean, p_amount_paise integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cur jsonb; v_new jsonb;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_on is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request', 'message', 'Say on or off.');
  end if;
  if p_amount_paise is null or p_amount_paise < 500 or p_amount_paise > 10000 or p_amount_paise % 500 <> 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount', 'message', 'Pick Rs 5 to Rs 100, in steps of Rs 5.');
  end if;
  select value into v_cur from settings where name = 'rider_incentive' for update;
  v_new := jsonb_build_object('on', p_on, 'amount_paise', p_amount_paise);
  if v_new = v_cur then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  update settings set value = v_new, updated_by = auth.uid(), updated_at = now() where name = 'rider_incentive';
  insert into rider_incentive_log (on_, amount_paise, by_label) values (p_on, p_amount_paise, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'changed', true);
end $$;

create function rider_incentive_rates() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := now() - interval '35 days';
begin
  if not (is_admin() or exists (select 1 from riders where user_id = auth.uid())) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'on', (select (value ->> 'on')::boolean from settings where name = 'rider_incentive'),
    'amount_paise', (select (value ->> 'amount_paise')::integer from settings where name = 'rider_incentive'),
    'log', coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'on', l.on_, 'amount_paise', l.amount_paise) order by l.at)
                     from (select * from rider_incentive_log where at >= v_since
                           union all (select * from rider_incentive_log where at < v_since order by at desc limit 1)) l), '[]'::jsonb));
end $$;
revoke all on function rider_incentive_get_v2() from public, anon;
revoke all on function rider_incentive_set_v2(boolean, integer) from public, anon;
revoke all on function rider_incentive_rates() from public, anon;
grant execute on function rider_incentive_get_v2() to authenticated;
grant execute on function rider_incentive_set_v2(boolean, integer) to authenticated;
grant execute on function rider_incentive_rates() to authenticated;
