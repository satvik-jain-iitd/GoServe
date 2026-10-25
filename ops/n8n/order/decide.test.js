// Story #46 tests, written BEFORE the code (red first). Run: node --test "ops/n8n/order/*.test.js"
// S1 rule first, Jev second  S2 Jev down  S3 run log  (SUB 13 Decide, SUB 14 Write logs, and their place in MAIN 01)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, PLACEHOLDER } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub19: 'SUB19', sub20: 'SUB20', sub21: 'SUB21', sub22: 'SUB22', alert: 'ALERT1' };
const wf = build({ ids: IDS });
const UUID = '11111111-1111-1111-1111-111111111111';
const ORDER = '22222222-2222-2222-2222-222222222222';
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, json, others) => new Function('$input', '$', src(file))({ first: () => ({ json }) }, (n) => ({ first: () => ({ json: others[n] }) }))[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);

const RIDERS = [
  { id: 'r1', free: true, distance_m: 1200, trips_done: 2 },
  { id: 'r2', free: true, distance_m: 2100, trips_done: 0 },
  { id: 'r3', free: false, distance_m: 300, trips_done: 0 },
];
const base = { kill_switch: false, supabase_url: 'u', session_id: 's1', kitchen_id: UUID, order_id: ORDER, riders: RIDERS, params_version: 3,
  jev_enabled: true, jev_model: 'typesafe/jev-1.13', jev_cost_cap: 0.001 };
const guard = (over) => run('decide_guard.js', { ...base, ...over });

test('S1 rule: free rider with the fewest trips, then the shortest distance, else none', () => {
  assert.equal(guard({}).rule_pick, 'r2');
  assert.equal(guard({ riders: [{ id: 'a', free: true, distance_m: 900, trips_done: 1 }, { id: 'b', free: true, distance_m: 400, trips_done: 1 }] }).rule_pick, 'b');
  assert.equal(guard({ riders: RIDERS.map((r) => ({ ...r, free: false })) }).rule_pick, 'none');
  assert.deepEqual(guard({}).options, ['r1', 'r2', 'r3', 'none']);
});

test('S1 Jev request: the decisions endpoint body, pinned model, one choice question over the rider ids, no names or addresses', () => {
  const g = guard({ riders: [{ ...RIDERS[0], name: 'Ravi Kumar', phone: '999' }, RIDERS[1]], address: 'Flat 4' });
  const b = g.jev_body;
  assert.equal(b.model, 'typesafe/jev-1.13');
  assert.deepEqual(Object.keys(b.questions), ['rider']);
  assert.equal(b.questions.rider.type, 'choice');
  assert.deepEqual(Object.keys(b.questions.rider.criteria), ['r1', 'r2', 'none']);
  assert.ok(b.questions.rider.instructions.length > 10);
  assert.deepEqual(b.state, g.state);
  assert.ok(!/Ravi|999|Flat 4/.test(JSON.stringify(b)));
  assert.equal(b.messages, undefined);   // not a chat body: the decisions endpoint takes state and questions
});

test('S1 Jev is asked at the decisions endpoint, not chat completions (found live on 15 Oct: chat gives 400 for a decisions model)', () => {
  assert.equal(byName(wf.sub13, 'Ask Jev').parameters.url, 'https://openrouter.ai/api/alpha/decisions');
});

test('S1 refusals: kill switch gives 503; bad input gives 400', () => {
  const k = guard({ kill_switch: true });
  assert.deepEqual([k.ok, k.status_code, k.error], [false, 503, 'kill_switch']);
  for (const bad of [{ riders: [] }, { riders: 'x' }, { order_id: 'nope' }, { riders: [{ id: 'a', free: true }, { id: 'a', free: true }] }, { session_id: '' }, { riders: new Array(11).fill(0).map((_, i) => ({ id: 'r' + i, free: true, distance_m: 1, trips_done: 0 })) }]) {
    assert.equal(guard(bad).status_code, 400, JSON.stringify(bad).slice(0, 50));
  }
});

const pick = (g, engine) => run('decide_engine.js', engine === undefined ? { statusCode: 200, body: [] } : { statusCode: 200, body: [{ version: 1, value: { engine } }] }, { Guard: g });
const ctx = () => ({ Guard: guard({}), 'Pick engine': pick(guard({}), 'jev') });   // H: Jev is the engine in these Jev tests (story #263)
// The shape OpenRouter's decisions endpoint answered on 15 Oct 2026 for a choice question (cost and fields from the real call).
const jevReply = (content, over) => ({ statusCode: 200, body: { id: 'gen-dec-1', model: 'typesafe/jev-1.13', provider: 'TypeSafe', answers: { rider: { type: 'choice', choice: content.choice, confidence: content.confidence, probabilities: {} } }, usage: { input_tokens: 477, output_tokens: 50, cost: 0.00002 } }, ...over });
const decide = (res, g) => run('decide_result.js', res, g || ctx());

test('S1 one row records both: rule pick, Jev pick with confidence, and the pick used', () => {
  const r = decide(jevReply({ choice: 'r2', confidence: 0.81, reason: 'closest free rider' }));
  const d = r.log_row.decision;
  assert.deepEqual([r.ok, r.status_code], [true, 200]);
  assert.deepEqual([d.use_case, d.schema_version, d.rule_pick, d.chosen_pick, d.chosen_by, d.chosen_chance, d.params_version, d.place], ['D1', 1, 'r2', 'r2', 'rule', 1, 3, 'demo']);
  assert.deepEqual([d.jev.pick, d.jev.confidence, d.jev.model, d.jev.agrees, d.jev_status], ['r2', 0.81, 'typesafe/jev-1.13', true, 'ok']);
  assert.equal(r.log_row.session_id, 's1');
  assert.equal(r.log_row.order_id, ORDER);
});

test('S1 the rule decides: if Jev disagrees, the rule pick is still used', () => {
  const d = decide(jevReply({ choice: 'r1', confidence: 0.95, reason: 'x' })).log_row.decision;
  assert.deepEqual([d.jev.agrees, d.chosen_pick, d.jev_status], [false, 'r2', 'ok']);
});

test('S2 Jev down or unusable: the rule decision goes through and the row says why', () => {
  const cases = [
    ['jev_error', { error: 'timeout' }],
    ['jev_error', { statusCode: 500, body: {} }],
    ['jev_bad_reply', { statusCode: 200, body: { answers: {} } }],
    ['jev_bad_reply', { statusCode: 200, body: '<html>oops</html>' }],
    ['jev_bad_reply', { statusCode: 200, body: { answers: { rider: { type: 'noul', noul: 0.9 } } } }],
    ['jev_bad_reply', jevReply({ choice: 'r9', confidence: 0.9, reason: 'x' })],
    ['jev_bad_reply', jevReply({ choice: 'r2', reason: 'x' })],
    ['jev_low_confidence', jevReply({ choice: 'r2', confidence: 0.5, reason: 'x' })],
    ['cost_cap', { ...jevReply({ choice: 'r2', confidence: 0.9, reason: 'x' }), body: { ...jevReply({ choice: 'r2', confidence: 0.9, reason: 'x' }).body, usage: { cost: 0.5 } } }],
  ];
  for (const [status, res] of cases) {
    const r = decide(res);
    assert.deepEqual([r.ok, r.log_row.decision.chosen_pick, r.log_row.decision.jev_status], [true, 'r2', status], status + ' ' + JSON.stringify(res).slice(0, 40));
  }
  const g = guard({ jev_enabled: false });
  const off = decide({}, { Guard: g, 'Pick engine': pick(g, 'jev') }).log_row.decision;
  assert.deepEqual([off.chosen_pick, off.jev_status, off.jev], ['r2', 'jev_off', null]);
});

// ---- Story #263: the engine switch. Rules makes no Jev call at all; Jev is today's behaviour; Laya is not deployed so the rule decides. ----
test('#263 Pick engine: rules turns Jev off even when Config has it on; jev keeps today; laya and anything unreadable fall back to the rule', () => {
  const g = guard({});
  assert.deepEqual([pick(g, 'rules').engine, pick(g, 'rules').use_jev], ['rules', false]);
  assert.deepEqual([pick(g, 'jev').engine, pick(g, 'jev').use_jev], ['jev', true]);
  assert.deepEqual([pick(g, 'laya').engine, pick(g, 'laya').use_jev], ['laya', false]);
  assert.deepEqual([pick(g).engine, pick(g).use_jev], ['rules', false]);   // no row
  for (const res of [{ error: 'timeout' }, { statusCode: 500, body: { message: 'x' } }, { statusCode: 200, body: [{ value: { engine: 'gpt' } }] }, { statusCode: 200, body: '<html>' }]) {
    const r = run('decide_engine.js', res, { Guard: g });
    assert.deepEqual([r.engine, r.use_jev], ['rules', false], JSON.stringify(res));
  }
  const off = guard({ jev_enabled: false });
  assert.equal(pick(off, 'jev').use_jev, false);   // the cost switch in Config still wins
  assert.equal(pick(g, 'rules').rule_pick, g.rule_pick);   // the rest of the Guard item goes on untouched
});

test('#263 the row says which engine decided: rules gives engine_rules and no Jev, laya gives laya_not_deployed, jev is unchanged', () => {
  const g = guard({});
  const rules = decide({}, { Guard: g, 'Pick engine': pick(g, 'rules') }).log_row.decision;
  assert.deepEqual([rules.engine, rules.jev_status, rules.jev, rules.chosen_pick, rules.chosen_by], ['rules', 'engine_rules', null, 'r2', 'rule']);
  const laya = decide({}, { Guard: g, 'Pick engine': pick(g, 'laya') }).log_row.decision;
  assert.deepEqual([laya.engine, laya.jev_status, laya.chosen_pick], ['laya', 'laya_not_deployed', 'r2']);
  const jev = decide(jevReply({ choice: 'r2', confidence: 0.8, reason: 'x' })).log_row.decision;
  assert.deepEqual([jev.engine, jev.jev_status], ['jev', 'ok']);
});

test('S1 the log write: a stored row gives 200, a database failure gives 502 without raw text', () => {
  const ok = run('decide_done.js', { statusCode: 201, body: '' }, { Decide: decide(jevReply({ choice: 'r2', confidence: 0.8, reason: 'x' })) });
  assert.deepEqual([ok.ok, ok.status_code, ok.decision.chosen_pick], [true, 200, 'r2']);
  const bad = run('decide_done.js', { statusCode: 409, body: { message: 'insert or update on table violates foreign key' } }, { Decide: decide({}) });
  assert.deepEqual([bad.ok, bad.status_code, bad.error], [false, 502, 'database_error']);
  assert.ok(!JSON.stringify(bad).includes('foreign'));
});

test('S3 run log: SUB 14 turns a run into a run_log row; bad input is refused', () => {
  const log = { session_id: 's1', kitchen_id: UUID, workflow: 'GS MAIN 01 Order API: place', params_version: 3, duration_ms: 120, cost: 0.00002, error: '', supabase_url: 'u' };
  const g = run('guard_log.js', log);
  assert.equal(g.ok, true);
  assert.deepEqual(g.log_row, { session_id: 's1', kitchen_id: UUID, workflow: 'GS MAIN 01 Order API: place', params_version: 3, duration_ms: 120, cost: 0.00002, error: null });
  assert.equal(run('guard_log.js', { ...log, error: 'illegal_step' }).log_row.error, 'illegal_step');
  for (const bad of [{ session_id: '' }, { kitchen_id: 'x' }, { workflow: '' }, { duration_ms: -1 }, { params_version: 'a' }]) {
    assert.equal(run('guard_log.js', { ...log, ...bad }).status_code, 400, JSON.stringify(bad));
  }
  assert.equal(run('guard_log.js', { ...log, cost: undefined }).log_row.cost, 0);
});

test('S3 MAIN 01 writes a run row after it answers: time, settings version, cost, error', () => {
  const res = { ok: true, status_code: 201, order: { id: ORDER } };
  const cfg = { 'Check token': { action: 'place', started_at: Date.now() - 50, params_version: 3, kitchen_id: UUID, supabase_url: 'u', body: { session_id: 's1' } } };
  const out = run('log_run.js', res, cfg);
  assert.deepEqual([out.session_id, out.kitchen_id, out.workflow, out.params_version, out.error], ['s1', UUID, 'GS MAIN 01 Order API: place', 3, '']);
  assert.ok(out.duration_ms >= 0 && out.duration_ms < 1e12);
  assert.equal(out.cost, 0);
  assert.equal(run('log_run.js', res, { 'Check token': { ...cfg['Check token'], body: {} } }).session_id, 'unknown');   // a bad-input run still gets a row
  const err = run('log_run.js', { ok: false, status_code: 409, error: 'illegal_step', message: 'm' }, cfg);
  assert.equal(err.error, 'illegal_step');
  const dec = run('log_run.js', { ok: true, status_code: 200, cost: 0.00002 }, { 'Check token': { ...cfg['Check token'], action: 'decide' } });
  assert.deepEqual([dec.workflow, dec.cost], ['GS MAIN 01 Order API: decide', 0.00002]);
});

test('wiring: MAIN 01 has a decide route and logs every routed run through SUB 14', () => {
  const c = wf.main01.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual(next('Route', 2), ['Call SUB 13 Decide']);
  assert.deepEqual(next('Route', 7), ['Respond 400']);
  assert.deepEqual(next('Call SUB 13 Decide'), ['Respond result']);
  assert.deepEqual(next('Respond result').sort(), ['Log run', 'Push?', 'Ready?']);   // story A5: a ready order is dispatched after the answer
  assert.deepEqual(next('Log run'), ['Call SUB 14 Write logs']);
  assert.equal(byName(wf.main01, 'Call SUB 13 Decide').parameters.workflowId.value, 'SUB13');
  assert.equal(byName(wf.main01, 'Call SUB 14 Write logs').parameters.workflowId.value, 'SUB14');
  assert.equal(byName(wf.main01, 'Call SUB 14 Write logs').parameters.options.waitForSubWorkflow, true);
  for (const call of ['Call SUB 13 Decide', 'Call SUB 14 Write logs']) {
    const sub = call.includes('13') ? wf.sub13 : wf.sub14;
    const declared = byName(sub, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
    assert.deepEqual(Object.keys(byName(wf.main01, call).parameters.workflowInputs.value).sort(), declared);
  }
  assert.ok(wf.main01.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length <= 24);   // rulebook 95.1: aim for 15; split at about 25
});

test('wiring: SUB 13 asks Jev only after the guard, Jev failure never stops the rule, then one log write', () => {
  const c = wf.sub13.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual(next('Guard'), ['Allowed?']);
  assert.deepEqual([next('Allowed?', 0), next('Allowed?', 1)], [['Read engine'], ['Return refusal']]);   // #263: the engine is read on every call
  assert.deepEqual(next('Read engine'), ['Pick engine']);
  assert.deepEqual(next('Pick engine'), ['Ask Jev?']);
  const re = byName(wf.sub13, 'Read engine');
  assert.match(re.parameters.url, /rest\/v1\/params\?select=value,version&session_id=eq\.global&key=eq\.decision_engine&order=version\.desc&limit=1/);
  assert.equal(re.onError, 'continueRegularOutput');   // an unreadable engine means Rules, never a stopped order
  assert.equal(re.parameters.method, 'GET');
  assert.deepEqual([next('Ask Jev?', 0), next('Ask Jev?', 1)], [['Ask Jev'], ['Decide']]);
  assert.deepEqual(next('Ask Jev'), ['Decide']);
  assert.deepEqual(next('Decide'), ['Write decision']);
  assert.deepEqual(next('Write decision'), ['Decision stored']);
  const jev = byName(wf.sub13, 'Ask Jev');
  assert.equal(jev.onError, 'continueRegularOutput');                 // advice only, never a write path
  assert.equal(jev.parameters.options.timeout, 1500);
  assert.notEqual(jev.retryOnFail, true);                              // no retry: worst case 1.5 s, not 3.2 s (owner, 15 Oct)
  assert.equal(byName(wf.sub13, 'Write decision').onError, undefined);   // the write path fails closed (B7)
  assert.match(jev.parameters.url, /openrouter\.ai\/api\/alpha\/decisions/);
  assert.equal(jev.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(byName(wf.sub14, 'Write run log').parameters.options.response.response.neverError, true);
});

test('safety: SUB 13 and SUB 14 only accept MAIN 01, report to ERR 00, and hold no secret', () => {
  for (const sub of [wf.sub13, wf.sub14]) {
    assert.equal(sub.settings.callerPolicy, 'workflowsFromAList');
    assert.deepEqual(sub.settings.callerIds.split(',').filter((x) => x !== 'SUB22'), ['MAIN1']);   // SUB 13 is also called by SUB 22, the dispatch (story A5)
    assert.equal(sub.settings.errorWorkflow, 'ALERT1');
  }
  assert.ok(!/sk-or-v1/.test(JSON.stringify(wf)));
  const cfg = byName(wf.main01, 'Config').parameters.assignments.assignments;
  for (const k of ['params_version', 'kitchen_id', 'jev_enabled', 'jev_model', 'jev_cost_cap']) assert.ok(cfg.find((a) => a.name === k), 'Config key ' + k);
  assert.equal(cfg.find((a) => a.name === 'demo_token').value, PLACEHOLDER);
});

test('check token passes the tunables and a start time on; decide is a known action', () => {
  const j = { demo_token: 'a', headers: { 'x-gs-token': 'a' }, body: { action: 'decide' }, kill_switch: false, supabase_url: 'u', params_version: 3, kitchen_id: UUID,
    jev_enabled: true, jev_model: 'm', jev_cost_cap: 0.001 };
  const r = run('check_token.js', j);
  assert.equal(r.action, 'decide');
  assert.deepEqual([r.params_version, r.kitchen_id, r.jev_enabled, r.jev_model, r.jev_cost_cap], [3, UUID, true, 'm', 0.001]);
  assert.ok(Number.isFinite(r.started_at));
});

for (const key of ['sub13', 'sub14', 'main01']) {
  test(`canvas layout ${key} (with decide and logs)`, () => {
    assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
  });
}

// ---- Story #272: the rule is made in SQL (dispatch_candidates ranks the riders: nearest first, trips only inside a band); the guard and the prepare node follow the rank. ----
test('#272 the guard picks the lowest rank among free riders; riders without a rank keep the old rule', () => {
  const ranked = [{ id: 'r1', free: true, distance_m: 3000, trips_done: 0, rank: 2 }, { id: 'r2', free: true, distance_m: 400, trips_done: 9, rank: 1 }, { id: 'r3', free: false, distance_m: 100, trips_done: 0, rank: 3 }];
  assert.equal(guard({ riders: ranked }).rule_pick, 'r2');   // nearest, although he has more trips
  assert.equal(guard({ riders: ranked.map(({ rank, ...r }) => r) }).rule_pick, 'r1');   // an old payload: fewest trips first, as before
  assert.equal(guard({ riders: ranked.map((r) => ({ ...r, free: false })) }).rule_pick, 'none');
});

test('#272 the prepare node sends the ten best by rank, or the ten nearest when there is no rank', () => {
  const start = { session_id: 's', kitchen_id: UUID, order_id: ORDER, params_version: 1, jev_enabled: false, jev_model: 'm', jev_cost_cap: 1, kill_switch: false, supabase_url: 'u' };
  const rs = Array.from({ length: 12 }, (_, i) => ({ id: 'r' + i, free: true, distance_m: 100 * (12 - i), trips_done: 0, rank: i + 1 }));
  const r = run('dispatch_prepare.js', { riders: rs.slice().reverse() }, { Start: start });
  assert.deepEqual(r.riders.map((x) => x.id), rs.slice(0, 10).map((x) => x.id));
  const noRank = run('dispatch_prepare.js', { riders: rs.map(({ rank, ...x }) => x) }, { Start: start });
  assert.equal(noRank.riders[0].id, 'r11');   // the nearest
});
