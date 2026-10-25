// SUB 13, node "Decide": Jev is advice only, the rule decides (build design section 4, contract 1.5). Builds the one decision_log row.
// Jev is accepted into the record when it answers in time, in shape, with enough confidence and under the cost cap; otherwise the row says why.
const g = $('Pick engine').first().json;   // the Guard item plus the engine (story #263)
const res = $input.first().json || {};
const THRESHOLD = 0.70;   // contract D1
let jev = null;
let status = g.engine === 'rules' ? 'engine_rules' : g.engine === 'laya' ? 'laya_not_deployed' : 'jev_off';   // why Jev did not answer
if (g.use_jev) {
  status = 'jev_error';
  if (!res.error && res.statusCode === 200) {
    status = 'jev_bad_reply';
    const body = res.body && typeof res.body === 'object' ? res.body : {};
    const a = body.answers && body.answers.rider;   // { type: 'choice', choice, confidence, probabilities }
    const reply = a && a.type === 'choice' ? a : null;
    const cost = body.usage && typeof body.usage.cost === 'number' ? body.usage.cost : 0;
    if (reply && g.options.includes(reply.choice) && typeof reply.confidence === 'number' && reply.confidence >= 0 && reply.confidence <= 1) {
      jev = { pick: reply.choice, confidence: reply.confidence, model: body.model || null,
        ms: Date.now() - g.started_at, cost, agrees: reply.choice === g.rule_pick };
      status = cost > g.jev_cost_cap ? 'cost_cap' : reply.confidence < THRESHOLD ? 'jev_low_confidence' : 'ok';
    }
  }
}
const decision = { use_case: 'D1', schema_version: 1, engine: g.engine, order_id: g.order_id, state: g.state, options: g.options, rule_pick: g.rule_pick,
  jev, jev_status: status, chosen_pick: g.rule_pick, chosen_by: 'rule', chosen_chance: 1, params_version: g.params_version, place: 'demo', result: null };
return [{ json: { ok: true, status_code: 200, supabase_url: g.supabase_url, cost: jev ? jev.cost : 0,
  log_row: { kitchen_id: g.kitchen_id, session_id: g.session_id, order_id: g.order_id, decision } } }];
