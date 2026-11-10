-- Story #1260 (epic #1259, boards P6, R7, A10): pay at the door, cash or UPI by the rider's QR. No payment gateway; nothing is charged at order time.
-- 1) A setting `payment_methods` lists the ways that are on: cash, upi_door. Default both on (owner, 10 Nov 2026: UPI at the door is on at go-live; the real QR image gates the prod release, not this switch).
-- 2) Only an admin changes it, through payment_methods_set_v2, one method at a time. The last method cannot go off. Every change is logged with who and when (payment_methods_log, admin read only).
-- 3) Customers read only the list that is on, through payment_methods_on(); the settings table, the log and who changed it stay closed to them.
-- 4) orders.paid_by takes cash or upi_door. The rider's deliver step records it (act_on_order, p_arg); a method that is off is refused before the order moves.
--    No method in p_arg (an old rider app) counts as cash while cash is on, and is refused with a clear line when cash is off.
-- Kitchen and rider cash totals already count only paid_by 'cash' or unset as cash, so a UPI order is never in them.

alter table settings add constraint settings_payment_methods_rule check (name <> 'payment_methods' or
  case when jsonb_typeof(value) = 'array' then jsonb_array_length(value) >= 1 and value <@ '["cash","upi_door"]'::jsonb else false end);
insert into settings (name, value) values ('payment_methods', '["cash","upi_door"]'::jsonb) on conflict (name) do nothing;

create table payment_methods_log (
  id uuid primary key default gen_random_uuid(),
  methods jsonb not null,
  by_user uuid default auth.uid(),
  by_label text,
  at timestamptz not null default now()
);
alter table payment_methods_log enable row level security;
create policy payment_methods_log_admin_read on payment_methods_log for select to authenticated using (is_admin());
revoke all on payment_methods_log from public, anon, authenticated;
grant select on payment_methods_log to authenticated;

create function payment_methods_on() returns jsonb
language sql stable security definer set search_path = public as $$
  select value from settings where name = 'payment_methods'
$$;
revoke all on function payment_methods_on() from public;
grant execute on function payment_methods_on() to anon, authenticated, service_role;

create function payment_methods_get_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('methods', s.value, 'updated_by', u.email, 'updated_at', s.updated_at)
          from settings s left join auth.users u on u.id = s.updated_by where s.name = 'payment_methods');
end $$;

-- One method at a time. The row is locked, so two admins at once are two orderly changes; the second that finds nothing to change says changed false and logs nothing.
create function payment_methods_set_v2(p_method text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cur jsonb; v_new jsonb;
begin
  if not is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_method is null or p_method not in ('cash', 'upi_door') or p_on is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_method', 'message', 'This way of paying does not exist.');
  end if;
  select value into v_cur from settings where name = 'payment_methods' for update;
  select coalesce(jsonb_agg(m order by m), '[]'::jsonb) into v_new
    from (select m from jsonb_array_elements_text(v_cur) m where m <> p_method union select p_method where p_on) x;
  if v_new <@ v_cur and v_cur <@ v_new then
    return jsonb_build_object('ok', true, 'changed', false, 'methods', v_cur);
  end if;
  if jsonb_array_length(v_new) = 0 then
    return jsonb_build_object('ok', false, 'error', 'last_method', 'message', 'One way to pay must stay on.');
  end if;
  update settings set value = v_new, updated_by = auth.uid(), updated_at = now() where name = 'payment_methods';
  insert into payment_methods_log (methods, by_label) values (v_new, auth.jwt() ->> 'email');
  return jsonb_build_object('ok', true, 'changed', true, 'methods', v_new);
end $$;
revoke all on function payment_methods_get_v2() from public, anon;
revoke all on function payment_methods_set_v2(text, boolean) from public, anon;
grant execute on function payment_methods_get_v2() to authenticated;
grant execute on function payment_methods_set_v2(text, boolean) to authenticated;

alter table orders drop constraint if exists orders_paid_by_check;
alter table orders add constraint orders_paid_by_check check (paid_by in ('cash', 'upi_door'));

-- act_on_order of migration 20261027220000 with the deliver step recording the method.
create or replace function act_on_order(p_order uuid, p_action text, p_arg text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v orders;
  v_admin boolean;
  v_kitchen boolean;
  v_rider boolean;
  v_customer boolean;
  v_may boolean;
  v_res jsonb;
  v_method text;
  v_on jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized', 'message', 'Sign in first.');
  end if;
  if p_action is null or p_action not in ('accept', 'prepare', 'ready', 'pickup', 'arriving', 'deliver', 'confirm', 'cancel') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action', 'message', 'This step does not exist.');
  end if;
  select * into v from orders where id = p_order;
  if v.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  -- coalesce: an order with no rider gives null, and null must never read as a yes
  v_admin := coalesce(is_admin(), false);
  v_kitchen := coalesce(is_my_kitchen(v.kitchen_id), false);
  v_rider := coalesce(v.rider_id = v_uid, false);
  v_customer := coalesce(v.session_id = v_uid::text, false);

  v_may := case p_action
       when 'accept' then v_admin or v_kitchen
       when 'prepare' then v_admin or v_kitchen
       when 'ready' then v_admin or v_kitchen
       when 'pickup' then v_admin or v_rider
       when 'arriving' then v_admin or v_rider
       when 'deliver' then v_admin or v_rider
       when 'confirm' then v_customer
       else v_admin or v_kitchen or v_customer
     end;
  if not coalesce(v_may, false) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'You cannot do this step on this order.');
  end if;

  -- story #348: an online order waits for its payment; cash on delivery is untouched
  if p_action = 'accept' and v.payment_method = 'online' and v.paid_at is null then
    return jsonb_build_object('ok', false, 'error', 'awaiting_payment', 'message', 'The order is waiting for its payment.');
  end if;

  -- story #1260: the rider's deliver step records how the order was paid. No method (an old rider app) counts as cash. A method that is off is refused before anything changes.
  if p_action = 'deliver' and v.payment_method <> 'online' then
    v_method := coalesce(p_arg, 'cash');
    if v_method not in ('cash', 'upi_door') then
      return jsonb_build_object('ok', false, 'error', 'invalid_method', 'message', 'This way of paying does not exist.');
    end if;
    select value into v_on from settings where name = 'payment_methods';
    if not exists (select 1 from jsonb_array_elements_text(v_on) m where m = v_method) then
      return jsonb_build_object('ok', false, 'error', 'method_off', 'message', case when p_arg is null then 'Cash is not on. Say how the customer paid.' else 'This way of paying is not on. Pick another.' end);
    end if;
  end if;

  begin
    v_res := case p_action
      when 'accept' then change_status(v.id, v.session_id, 'accepted', case when v_admin then 'admin' else 'kitchen' end)
      when 'prepare' then change_status(v.id, v.session_id, 'preparing', case when v_admin then 'admin' else 'kitchen' end)
      when 'ready' then change_status(v.id, v.session_id, 'ready', case when v_admin then 'admin' else 'kitchen' end)
      when 'pickup' then change_status(v.id, v.session_id, 'out_for_delivery', case when v_rider then 'rider' else 'admin' end)
      when 'deliver' then change_status(v.id, v.session_id, 'delivered', case when v_rider then 'rider' else 'admin' end)
      when 'arriving' then rider_event(v.id, v.session_id, 'order.arriving', case when v_rider then 'rider' else 'admin' end)
      when 'confirm' then confirm_delivery(v.id, v.session_id)
      else cancel_order(v.id, p_arg)
    end;
    if p_action = 'deliver' and v_method is not null then
      update orders set paid_by = v_method where id = v.id;
      v_res := jsonb_set(v_res, '{order,paid_by}', to_jsonb(v_method));
    end if;
  exception when others then
    return case
      when sqlerrm like 'already_done%' or sqlerrm like 'event_exists%' then jsonb_build_object('ok', false, 'error', 'already_done', 'message', 'This step was already done.')
      when sqlerrm like 'illegal%' then jsonb_build_object('ok', false, 'error', 'illegal_step', 'message', 'The order is not at the step before this one.')
      when sqlerrm like 'cannot_cancel%' then jsonb_build_object('ok', false, 'error', 'cannot_cancel', 'message', 'The food is already on its way. It cannot be cancelled now.')
      when sqlerrm like 'reason_required%' then jsonb_build_object('ok', false, 'error', 'reason_required', 'message', 'Say why you are cancelling.')
      when sqlerrm like 'not_allowed%' then jsonb_build_object('ok', false, 'error', 'not_allowed', 'message', 'You cannot do this step on this order.')
      else jsonb_build_object('ok', false, 'error', 'order_action_failed', 'message', 'The step could not be done. Try again.')
    end;
  end;
  if p_action = 'cancel' then   -- story #348: a paid payment is owed back, an unpaid one is closed
    update payments set status = case when status = 'paid' then 'refund_due' else 'failed' end, updated_at = now() where order_id = v.id and status in ('created', 'paid');
  end if;
  if coalesce((v_res->>'already_done')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'already_done', 'message', 'This step was already done.');
  end if;
  return jsonb_build_object('ok', true, 'order', v_res->'order');
end $$;

revoke all on function act_on_order(uuid, text, text) from public, anon;
grant execute on function act_on_order(uuid, text, text) to authenticated, service_role;
