-- Story S-M5 (#132). A Google user listed here works for a kitchen and reads every order of it, from any phone, without a join link (ADR-011 superseded for the kitchen).
-- Only the service role writes the table (scripts/add_kitchen_staff.py). The existing session rules stay.

create table kitchen_staff (
  kitchen_id uuid not null references kitchens (id),
  user_id uuid not null,   -- the Google user (auth.users.id)
  created_at timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);
alter table kitchen_staff enable row level security;
create policy staff_read_own_row on kitchen_staff for select to authenticated using (user_id = auth.uid());

-- Security definer so the order rules can look inside kitchen_staff, like is_my_session.
create function is_my_kitchen(p_kitchen uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from kitchen_staff where kitchen_id = p_kitchen and user_id = auth.uid())
$$;
revoke execute on function is_my_kitchen(uuid) from public, anon;
grant execute on function is_my_kitchen(uuid) to authenticated;

create policy orders_my_kitchen on orders for select to authenticated using (is_my_kitchen(kitchen_id));
create policy events_my_kitchen on order_events for select to authenticated using (is_my_kitchen(kitchen_id));
