// Story #46 tests, written BEFORE the code (red first). Run: node --test "ops/n8n/order/*.test.js"
// S1 rule first, Jev second  S2 Jev down  S3 run log  (SUB 13 Decide, SUB 14 Write logs, and their place in MAIN 01)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, PLACEHOLDER } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', alert: 'ALERT1' };
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

test('S1 Jev request: pinned model, temperature 0, 32 tokens, allowed choices, no names or addresses', () => {
  const g = guard({ riders: [{ ...RIDERS[0], name: 'Ravi Kumar', phone: '999' }, RIDERS[1]], address: 'Flat 4' });
  const b = g.jev_body;
  assert.deepEqual([b.model, b.temperature, b.max_tokens], ['typesafe/jev-1.13', 0, 32]);
  const text = b.messages[0].content;
  assert.match(text, /Allowed choices: r1, r2, none/);
  assert.match(text, /Reply with JSON only/);
  assert.ok(!/Ravi|999|Flat 4/.test(text + JSON.stringify(g.state)));
});

test('S1 refusals: kill switch gives 503; bad input gives 400', () => {
  const k = guard({ kill_switch: true });
  assert.deepEqual([k.ok, k.status_code, k.error], [false, 503, 'kill_switch']);
  for (const bad of [{ riders: [] }, { riders: 'x' }, { order_id: 'nope' }, { riders: [{ id: 'a', free: true }, { id: 'a', free: true }] }, { session_id: '' }, { riders: new Array(11).fill(0).map((_, i) => ({ id: 'r' + i, free: true, distance_m: 1, trips_done: 0 })) }]) {
    assert.equal(guard(bad).status_code, 400, JSON.stringify(bad).slice(0, 50));
  }
});

const ctx = () => ({ Guard: guard({}) });
const jevReply = (content, over) => ({ statusCode: 200, body: { model: 'typesafe/jev-1.13', choices: [{ message: { content: JSON.stringify(content) } }], usage: { cost: 0.00002 } }, ...over });
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
    ['jev_bad_reply', { statusCode: 200, body: { choices: [{ message: { content: 'not json' } }] } }],
    ['jev_bad_reply', jevReply({ choice: 'r9', confidence: 0.9, reason: 'x' })],
    ['jev_bad_reply', jevReply({ choice: 'r2', reason: 'x' })],
    ['jev_low_confidence', jevReply({ choice: 'r2', confidence: 0.5, reason: 'x' })],
    ['cost_cap', { ...jevReply({ choice: 'r2', confidence: 0.9, reason: 'x' }), body: { ...jevReply({ choice: 'r2', confidence: 0.9, reason: 'x' }).body, usage: { cost: 0.5 } } }],
  ];
  for (const [status, res] of cases) {
    const r = decide(res);
    assert.deepEqual([r.ok, r.log_row.decision.chosen_pick, r.log_row.decision.jev_status], [true, 'r2', status], status + ' ' + JSON.stringify(res).slice(0, 40));
  }
  const off = decide({}, { Guard: guard({ jev_enabled: false }) }).log_row.decision;
  assert.deepEqual([off.chosen_pick, off.jev_status, off.jev], ['r2', 'jev_off', null]);
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
  assert.deepEqual(next('Route', 3), ['Respond 400']);
  assert.deepEqual(next('Call SUB 13 Decide'), ['Respond result']);
  assert.deepEqual(next('Respond result'), ['Log run']);
  assert.deepEqual(next('Log run'), ['Call SUB 14 Write logs']);
  assert.equal(byName(wf.main01, 'Call SUB 13 Decide').parameters.workflowId.value, 'SUB13');
  assert.equal(byName(wf.main01, 'Call SUB 14 Write logs').parameters.workflowId.value, 'SUB14');
  assert.equal(byName(wf.main01, 'Call SUB 14 Write logs').parameters.options.waitForSubWorkflow, true);
  for (const call of ['Call SUB 13 Decide', 'Call SUB 14 Write logs']) {
    const sub = call.includes('13') ? wf.sub13 : wf.sub14;
    const declared = byName(sub, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
    assert.deepEqual(Object.keys(byName(wf.main01, call).parameters.workflowInputs.value).sort(), declared);
  }
  assert.ok(wf.main01.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length <= 15);
});

test('wiring: SUB 13 asks Jev only after the guard, Jev failure never stops the rule, then one log write', () => {
  const c = wf.sub13.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual(next('Guard'), ['Allowed?']);
  assert.deepEqual([next('Allowed?', 0), next('Allowed?', 1)], [['Ask Jev?'], ['Return refusal']]);
  assert.deepEqual([next('Ask Jev?', 0), next('Ask Jev?', 1)], [['Ask Jev'], ['Decide']]);
  assert.deepEqual(next('Ask Jev'), ['Decide']);
  assert.deepEqual(next('Decide'), ['Write decision']);
  assert.deepEqual(next('Write decision'), ['Decision stored']);
  const jev = byName(wf.sub13, 'Ask Jev');
  assert.equal(jev.onError, 'continueRegularOutput');                 // advice only, never a write path
  assert.equal(jev.parameters.options.timeout, 900);
  assert.equal(byName(wf.sub13, 'Write decision').onError, undefined);   // the write path fails closed (B7)
  assert.match(jev.parameters.url, /openrouter\.ai\/api\/v1\/chat\/completions/);
  assert.equal(jev.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(byName(wf.sub14, 'Write run log').parameters.options.response.response.neverError, true);
});

test('safety: SUB 13 and SUB 14 only accept MAIN 01, report to ERR 00, and hold no secret', () => {
  for (const sub of [wf.sub13, wf.sub14]) {
    assert.equal(sub.settings.callerPolicy, 'workflowsFromAList');
    assert.equal(sub.settings.callerIds, 'MAIN1');
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
