// SUB 20, node "Guard": kill switch, input, and which statuses are pushed. Placed, ready, out_for_delivery (picked up) and delivered only; any other status is not an error, there is just nothing to send.
// A refusal keeps the order and the address, so "Trace refused" can write a line: no refusal is silent (story #500).
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message, supabase_url: j.supabase_url, order_id: typeof j.order_id === 'string' && j.order_id !== '' ? j.order_id : null, status: j.status } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
if (typeof j.session_id !== 'string' || j.session_id.trim() === '' || j.session_id.length > 64
  || typeof j.vapid_public_key !== 'string' || j.vapid_public_key.length < 3 || typeof j.vapid_subject !== 'string' || j.vapid_subject === '') {
  return refuse(400, 'invalid_request', 'The push is missing something.');
}
if (!['placed', 'ready', 'out_for_delivery', 'delivered'].includes(j.status)) return refuse(200, 'not_pushed', 'No push for this status.');
return [{ json: { ok: true, supabase_url: j.supabase_url, order_id: typeof j.order_id === 'string' && j.order_id !== '' ? j.order_id : null, status: j.status, vapid_public_key: j.vapid_public_key, vapid_subject: j.vapid_subject, rpc_body: { p_session: j.session_id } } }];
