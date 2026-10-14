// SUB 13, node "Guard": kill switch, input check, then the RULE decision (contract D1 in docs/ai/JEV_D1_D5_CONTRACT.md) and the Jev request.
// The state sent to Jev has ids, free flag, distance and trips only: no names, phones or addresses.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const riders = j.riders;
const ridersOk = Array.isArray(riders) && riders.length >= 1 && riders.length <= 10
  && riders.every((r) => r && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 32 && typeof r.free === 'boolean')
  && new Set(riders.map((r) => r.id)).size === riders.length;
if (!ridersOk || typeof j.session_id !== 'string' || j.session_id.trim() === '' || j.session_id.length > 64
  || !uuid.test(String(j.kitchen_id)) || !uuid.test(String(j.order_id))) {
  return refuse(400, 'invalid_request', 'The decision is missing something.');
}
const state = { order_id: j.order_id, riders: riders.map((r) => ({ id: r.id, free: r.free, distance_m: Number(r.distance_m) || 0, trips_done: Number(r.trips_done) || 0 })) };
const free = state.riders.filter((r) => r.free).sort((a, b) => a.trips_done - b.trips_done || a.distance_m - b.distance_m);
const rule_pick = free.length ? free[0].id : 'none';
const options = state.riders.map((r) => r.id).concat('none');
const prompt = 'State: ' + JSON.stringify(state) + '\nQuestion: which rider should get order ' + j.order_id
  + '\nAllowed choices: ' + options.join(', ') + '\nReply with JSON only: {"choice":"...","confidence":0.0,"reason":"..."}';
return [{ json: { ok: true, supabase_url: j.supabase_url, use_jev: j.jev_enabled === true, rule_pick, options, state,
  session_id: j.session_id, kitchen_id: j.kitchen_id, order_id: j.order_id, params_version: j.params_version, jev_cost_cap: j.jev_cost_cap, started_at: Date.now(),
  jev_body: { model: j.jev_model || 'typesafe/jev-1.13', temperature: 0, max_tokens: 32, response_format: { type: 'json_object' }, usage: { include: true },
    messages: [{ role: 'user', content: prompt }] } } }];
