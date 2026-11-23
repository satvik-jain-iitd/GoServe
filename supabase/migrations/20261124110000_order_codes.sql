-- Story 1663 (epic 1652). Two codes for each order, made by the server, each readable only by its holder.
-- pickup_code: kitchen to rider; only the rider now assigned reads it. drop_code: rider to customer; only the order's customer reads it.
-- The table is closed like otp_codes (no policy, no grant). The checks that compare typed codes come in later stories.
create extension if not exists pgcrypto with schema extensions;

create table if not exists order_codes (
  order_id uuid primary key references orders (id) on delete cascade,
  pickup_code text not null,
  drop_code text not null,
  pickup_tries integer not null default 0,
  drop_tries integer not null default 0,
  pickup_locked boolean not null default false,
  drop_locked boolean not null default false,
  created_at timestamptz not null default now(),
  check (pickup_code <> drop_code)
);
alter table order_codes enable row level security;   -- no policy: only security definer functions read or write
revoke all on order_codes from public, anon, authenticated;

-- The one place the code length lives.
create or replace function order_code_len() returns integer language sql immutable as $$ select 4 $$;

create or replace function order_code_new() returns text
language sql volatile set search_path = public, extensions as $$
  select lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % (10 ^ order_code_len())::bigint)::text, order_code_len(), '0')   -- ponytail: tiny modulo bias, fine for a 4 digit code
$$;
revoke all on function order_code_new() from public, anon, authenticated;

create or replace function order_codes_make() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare p text := order_code_new(); d text := order_code_new();
begin
  while d = p loop d := order_code_new(); end loop;
  insert into order_codes (order_id, pickup_code, drop_code) values (new.id, p, d) on conflict do nothing;
  return new;
end $$;
revoke all on function order_codes_make() from public, anon, authenticated;
drop trigger if exists orders_codes_make on orders;
create trigger orders_codes_make after insert on orders for each row execute function order_codes_make();

-- Orders made before this migration get codes too.
do $$
declare r record; p text; d text;
begin
  for r in select id from orders where id not in (select order_id from order_codes) loop
    p := order_code_new(); d := order_code_new();
    while d = p loop d := order_code_new(); end loop;
    insert into order_codes (order_id, pickup_code, drop_code) values (r.id, p, d);
  end loop;
end $$;

-- The one read door. A rider assigned now gets only pickup_code; the order's customer gets only drop_code; nobody else gets anything.
create or replace function order_code_v1(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; c order_codes;
  none constant jsonb := jsonb_build_object('ok', false, 'error', 'no_code', 'message', 'No code for you on this order.');
begin
  select * into o from orders where id = p_order_id;
  if o.id is null or o.status in ('cancelled', 'delivered') then return none; end if;
  select * into c from order_codes where order_id = o.id;
  if c.order_id is null then return none; end if;
  if o.rider_id is not null and o.rider_id = auth.uid() then
    return jsonb_build_object('ok', true, 'role', 'rider', 'pickup_code', c.pickup_code);
  elsif is_my_session(o.session_id) then
    return jsonb_build_object('ok', true, 'role', 'customer', 'drop_code', c.drop_code);
  end if;
  return none;
end $$;
revoke all on function order_code_v1(uuid) from public, anon;
grant execute on function order_code_v1(uuid) to authenticated;

-- Internal: count a try; 5 wrong tries lock the code. Not granted to any app role. which = 'pickup' or 'drop'.
create or replace function order_code_try_v1(p_order_id uuid, p_which text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c order_codes; v_ok boolean; v_locked boolean; v_tries integer;
begin
  select * into c from order_codes where order_id = p_order_id for update;
  if c.order_id is null or p_which not in ('pickup', 'drop') then return jsonb_build_object('ok', false, 'error', 'no_code'); end if;
  v_locked := case p_which when 'pickup' then c.pickup_locked else c.drop_locked end;
  if v_locked then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
  v_ok := p_code = case p_which when 'pickup' then c.pickup_code else c.drop_code end;
  if v_ok then return jsonb_build_object('ok', true); end if;
  v_tries := 1 + case p_which when 'pickup' then c.pickup_tries else c.drop_tries end;
  if p_which = 'pickup' then update order_codes set pickup_tries = v_tries, pickup_locked = v_tries >= 5 where order_id = p_order_id;
  else update order_codes set drop_tries = v_tries, drop_locked = v_tries >= 5 where order_id = p_order_id; end if;
  return jsonb_build_object('ok', false, 'error', case when v_tries >= 5 then 'locked' else 'wrong_code' end, 'tries_left', greatest(5 - v_tries, 0));
end $$;
revoke all on function order_code_try_v1(uuid, text, text) from public, anon, authenticated;
