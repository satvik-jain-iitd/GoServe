// SUB 11, node "Guard": the kill switch is checked here again (rulebook 95.15), then the input shape. The database checks dishes and prices.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
if (!text(j.session_id, 64) || !text(j.client_order_key, 64) || !text(j.address, 300)
  || !Array.isArray(j.items) || j.items.length === 0 || j.items.length > 20) {
  return refuse(400, 'invalid_request', 'The order is missing something.');
}
return [{ json: { ok: true, supabase_url: j.supabase_url,
  rpc_body: { p_session: j.session_id, p_key: j.client_order_key, p_items: j.items, p_address: j.address } } }];
