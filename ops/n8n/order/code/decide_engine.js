// SUB 13, node "Pick engine": reads the answer of "Read engine" (rpc decision_gate: the engine, the daily Jev cap, today's Jev calls). Rules turns Jev off even when Config has it on;
// Jev is today's behaviour but only under the daily cap (story #253, default 0 = no Jev call); Laya is not deployed yet, so the rule decides.
// Anything unreadable or unknown means Rules: an order is never stopped by this switch.
const g = $('Guard').first().json;
const res = $input.first().json || {};
const body = !res.error && res.statusCode === 200 && res.body && typeof res.body === 'object' && !Array.isArray(res.body) ? res.body : {};
const engine = ['rules', 'jev', 'laya'].includes(body.engine) ? body.engine : 'rules';
const cap = Number(body.jev_cap);
const used = Number(body.jev_used);
const room = Number.isFinite(cap) && Number.isFinite(used) && cap > 0 && used < cap;   // a missing or bad number means no room
const jev_capped = engine === 'jev' && g.use_jev === true && !room;
return [{ json: Object.assign({}, g, { engine, jev_capped, use_jev: g.use_jev === true && engine === 'jev' && room }) }];
