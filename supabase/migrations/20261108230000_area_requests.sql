-- Story #1049 part 3 (board NK-A): "Tell me when you come here". A customer whose pin no kitchen serves asks once; the ask is stored with the pin, the place and the phone,
-- once per person and pin. Nothing is sent from here: the rows are the list the owner reads when a kitchen opens in that area.
create table area_requests (
  user_id uuid not null,
  pin text not null check (pin ~ '^[0-9]{6}$'),
  lat double precision,
  lng double precision,
  phone text,
  created_at timestamptz not null default now(),
  primary key (user_id, pin)
);
alter table area_requests enable row level security;
revoke all on area_requests from public, anon, authenticated;

create function area_request_add_v2(p_pin text, p_lat double precision default null, p_lng double precision default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'invalid_request'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_pin', 'message', 'That pin code is not valid.');
  end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180) then
    return jsonb_build_object('ok', false, 'error', 'invalid_place', 'message', 'That place is not valid.');
  end if;
  insert into area_requests (user_id, pin, lat, lng, phone)
  values (auth.uid(), p_pin, p_lat, p_lng, (select c.phone from customers c where c.user_id = auth.uid()))
  on conflict (user_id, pin) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function area_request_add_v2(text, double precision, double precision) from public, anon;
grant execute on function area_request_add_v2(text, double precision, double precision) to authenticated;
