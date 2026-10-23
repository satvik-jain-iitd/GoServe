// SUB 19, node "Guard": kill switch (rulebook 95.15), then the two ids. The database decides if the order is ready and the rider is online.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(String(j.order_id)) || !uuid.test(String(j.rider_id))) return refuse(400, 'invalid_request', 'The assignment is missing something.');
return [{ json: { ok: true, supabase_url: j.supabase_url, rpc_body: { p_order: j.order_id, p_rider: j.rider_id } } }];
