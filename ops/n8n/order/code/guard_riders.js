// SUB 21, node "Guard": kill switch, then the order id. Nothing is written: the database only reads the riders that are online.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(String(j.order_id))) return refuse(400, 'invalid_request', 'The order id is missing.');
return [{ json: { ok: true, supabase_url: j.supabase_url, rpc_body: { p_order: j.order_id } } }];
