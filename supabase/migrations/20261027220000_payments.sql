-- Story #348 (E27, plan v2 B.12). Payments, built with a test double (FakeGateway) until the owner's Razorpay KYC click (docs/product/founder-checklist.md).
-- State lives here: a payment row per online order; the order waits for it (act_on_order refuses accept until paid); cash on delivery keeps today's path
-- with no payment row; a cancel makes a paid payment refund_due, or closes an unpaid one. The gateway calls and the signature check are in the Edge Function.
-- Refusals are answers, not exceptions: {ok:false, error, message}. Only the service role calls the payment functions.
alter table orders
  add column payment_method text not null default 'cod' check (payment_method in ('cod', 'online')),
  add column paid_at timestamptz;

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  provider text not null,
  provider_order_id text not null,
  provider_payment_id text,
  amount_paise integer not null check (amount_paise >= 0),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refund_due', 'refunded')),
  signature_ok boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id)
);
create unique index payments_one_open on payments (order_id) where status in ('created', 'paid', 'refund_due');
alter table payments enable row level security;
create policy payments_own on payments for select to authenticated using (exists (select 1 from orders o where o.id = order_id and o.session_id = auth.uid()::text));
revoke all on payments from public, anon, authenticated;
grant select on payments to authenticated;

-- 1. Before the gateway is asked: whose order, how much, and is there a payment already. A stranger gets order_not_found.
create function payment_prepare_v2(p_order uuid, p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  p payments;
begin
  select * into o from orders where id = p_order and session_id = p_session;
  if o.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found', 'message', 'This order was not found.');
  end if;
  if o.status <> 'placed' or o.paid_at is not null then
    return jsonb_build_object('ok', false, 'error', case when o.paid_at is not null then 'already_paid' else 'order_not_payable' end, 'message', 'This order cannot be paid now.');
  end if;
  select * into p from payments where order_id = o.id and status = 'created';
  return jsonb_build_object('ok', true, 'amount_paise', o.total_paise, 'existing', p.provider_order_id);
end $$;

-- 2. After the gateway made its order: store it and make the order online. The first payment for an order stands.
create function payment_create_v2(p_order uuid, p_session text, p_provider text, p_provider_order_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prep jsonb := payment_prepare_v2(p_order, p_session);
  p payments;
begin
  if not (v_prep ->> 'ok')::boolean then
    return v_prep;
  end if;
  if v_prep ->> 'existing' is not null then
    select * into p from payments where order_id = p_order and status = 'created';
    return jsonb_build_object('ok', true, 'payment', jsonb_build_object('provider_order_id', p.provider_order_id, 'amount_paise', p.amount_paise));
  end if;
  insert into payments (order_id, provider, provider_order_id, amount_paise)
  values (p_order, p_provider, p_provider_order_id, (v_prep ->> 'amount_paise')::integer) returning * into p;
  update orders set payment_method = 'online' where id = p_order;
  return jsonb_build_object('ok', true, 'payment', jsonb_build_object('provider_order_id', p.provider_order_id, 'amount_paise', p.amount_paise));
end $$;

-- 3. The webhook, after the Edge Function checked the signature. A repeat changes nothing.
create function payment_paid_v2(p_provider text, p_provider_order_id text, p_provider_payment_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p payments;
begin
  select * into p from payments where provider = p_provider and provider_order_id = p_provider_order_id for update;
  if p.id is null then
    return jsonb_build_object('ok', false, 'error', 'payment_not_found', 'message', 'No such payment.');
  end if;
  if p.status in ('paid', 'refund_due', 'refunded') then
    return jsonb_build_object('ok', true, 'already_paid', true, 'order_id', p.order_id);
  end if;
  if p.status <> 'created' then
    return jsonb_build_object('ok', false, 'error', 'payment_closed', 'message', 'This payment was closed.');
  end if;
  update payments set status = 'paid', provider_payment_id = p_provider_payment_id, signature_ok = true, updated_at = now() where id = p.id;
  update orders set paid_at = now() where id = p.order_id;
  return jsonb_build_object('ok', true, 'order_id', p.order_id);
end $$;

-- 4. Refund: which payment is owed back, and mark it done after the gateway answered.
create function payment_refund_target_v2(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p payments;
begin
  select * into p from payments where order_id = p_order and status = 'refund_due';
  if p.id is null then
    return jsonb_build_object('ok', false, 'error', 'nothing_to_refund', 'message', 'Nothing is owed back on this order.');
  end if;
  return jsonb_build_object('ok', true, 'payment', jsonb_build_object('provider', p.provider, 'provider_payment_id', p.provider_payment_id, 'amount_paise', p.amount_paise));
end $$;

create function payment_refunded_v2(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update payments set status = 'refunded', updated_at = now() where order_id = p_order and status = 'refund_due';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'nothing_to_refund', 'message', 'Nothing is owed back on this order.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function payment_prepare_v2(uuid, text) from public, anon, authenticated;
revoke all on function payment_create_v2(uuid, text, text, text) from public, anon, authenticated;
revoke all on function payment_paid_v2(text, text, text) from public, anon, authenticated;
revoke all on function payment_refund_target_v2(uuid) from public, anon, authenticated;
revoke all on function payment_refunded_v2(uuid) from public, anon, authenticated;
grant execute on function payment_prepare_v2(uuid, text) to service_role;
grant execute on function payment_create_v2(uuid, text, text, text) to service_role;
grant execute on function payment_paid_v2(text, text, text) to service_role;
grant execute on function payment_refund_target_v2(uuid) to service_role;
grant execute on function payment_refunded_v2(uuid) to service_role;

-- act_on_order (migration 20261027170000) with two additions: accept waits for payment on an online order, and cancel settles the payment row.
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
