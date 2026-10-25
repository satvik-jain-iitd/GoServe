// SUB 13, node "Pick engine": reads the answer of "Read engine" (params global/decision_engine, latest version). Rules turns Jev off even when Config has it on;
// Jev is today's behaviour; Laya is not deployed yet, so the rule decides. Anything unreadable or unknown means Rules: an order is never stopped by this switch.
const g = $('Guard').first().json;
const res = $input.first().json || {};
const rows = !res.error && res.statusCode === 200 && Array.isArray(res.body) ? res.body : [];
const v = rows[0] && rows[0].value && rows[0].value.engine;
const engine = ['rules', 'jev', 'laya'].includes(v) ? v : 'rules';
return [{ json: Object.assign({}, g, { engine, use_jev: g.use_jev === true && engine === 'jev' }) }];
