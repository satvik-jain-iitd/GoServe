// SUB 15, node "Guard": kill switch (again, rulebook 95.15), then the input shape. Only the rider's "arriving" event is allowed here: status steps use SUB 12.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actors = ['customer', 'kitchen', 'rider', 'ops'];
if (typeof j.session_id !== 'string' || j.session_id.trim() === '' || j.session_id.length > 64
  || !uuid.test(String(j.order_id)) || j.event !== 'order.arriving' || !actors.includes(j.actor)) {
  return refuse(400, 'invalid_request', 'The event is missing something.');
}
return [{ json: { ok: true, supabase_url: j.supabase_url,
  rpc_body: { p_order: j.order_id, p_session: j.session_id, p_event: j.event, p_actor: j.actor } } }];
