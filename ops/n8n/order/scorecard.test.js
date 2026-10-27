// Story #47 tests, written BEFORE the code (red first): GS MAIN 90 Daily scorecard and GS SUB 91 Scorecard numbers.
// Story H14 (#204) changes: the card runs at 22:15, SUB 91 also reads the pilot numbers, and the message starts with the pilot block (pilot.test.js has its marks).
// Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub15: 'SUB15', sub16: 'SUB16', sub91: 'SUB91', sub93: 'SUB93', sub94: 'SUB94', main90: 'MAIN90', main92: 'MAIN92', main93: 'MAIN93', alert: 'ALERT1' };
const wf = build({ ids: IDS, chatId: '42' });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
// Runs a Code node as written. `named` maps a node name to the item that `$('name')` returns.
const run = (file, input, named = {}) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, (n) => ({ first: () => ({ json: named[n] || {} }) }))[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);

const runs = [
  { workflow: 'GS MAIN 01 Order API: place', duration_ms: 200, cost: 0, error: '' },
  { workflow: 'GS MAIN 01 Order API: status', duration_ms: 100, cost: 0, error: '' },
  { workflow: 'GS MAIN 01 Order API: decide', duration_ms: 900, cost: 0.00004, error: '' },
  { workflow: 'GS MAIN 01 Order API: decide', duration_ms: 500, cost: 0.00004, error: 'database_error' },
  { workflow: 'GS MAIN 01 Order API: health', duration_ms: 300, cost: 0.00002, error: '' },
];
const decisions = [
  { decision: { jev_status: 'ok', jev: { agrees: true } } },
  { decision: { jev_status: 'ok', jev: { agrees: false } } },
  { decision: { jev_status: 'jev_error', jev: null } },
];
const ok = (b) => ({ statusCode: 200, body: b });

test('S1 window: the last 24 hours, so an evening after 22:15 is in the next card', () => {
  const w = run('score_window.js', { now: '2026-10-14T16:45:00Z' });   // 22:15 in India
  assert.equal(w.since, '2026-10-13T16:45:00.000Z');
  assert.equal(w.until, '2026-10-14T16:45:00.000Z');
  assert.equal(w.until_label, '2026-10-14 22:15');
  assert.equal(w.period_label, 'last 24 hours');
  // a row at 23:00 India time on 14 Oct (17:30Z) is after this card and inside the next card's window (22:15 on 15 Oct)
  const next = run('score_window.js', { now: '2026-10-15T16:45:00Z' });
  assert.ok(Date.parse('2026-10-14T17:30:00Z') >= Date.parse(next.since));
  assert.equal(next.since, '2026-10-14T16:45:00.000Z');   // each card starts where the one before ended: no gap, no overlap
  assert.equal(run('score_window.js', { now: '2026-10-14T19:00:00Z' }).until_label, '2026-10-15 00:30');
});

test('S1 numbers: runs and errors, time, decisions with Jev use and agreement, cost; health checks counted apart', () => {
  const r = run('score_summary.js', {}, { 'Read runs': ok(runs), 'Read decisions': ok(decisions) });
  assert.deepEqual([r.ok, r.status_code], [true, 200]);
  assert.deepEqual(r.summary, { runs: 4, errors: 1, health_checks: 1, avg_ms: 425, max_ms: 900, cost: 0.0001, decide_cost: 0.00008, decisions: 3, jev_used: 2, jev_agreed: 1, engines: { rules: 0, jev: 0, laya: 0, older: 3 }, truncated: false, pilot: null });
});

test('S1 numbers: an empty day gives zeros, a full page is marked as cut', () => {
  const r = run('score_summary.js', {}, { 'Read runs': ok([]), 'Read decisions': ok([]) });
  assert.deepEqual(r.summary, { runs: 0, errors: 0, health_checks: 0, avg_ms: 0, max_ms: 0, cost: 0, decide_cost: 0, decisions: 0, jev_used: 0, jev_agreed: 0, engines: { rules: 0, jev: 0, laya: 0, older: 0 }, truncated: false, pilot: null });
  const many = Array.from({ length: 1000 }, () => ({ workflow: 'GS MAIN 01 Order API: status', duration_ms: 1, cost: 0, error: '' }));
  assert.equal(run('score_summary.js', {}, { 'Read runs': ok(many), 'Read decisions': ok([]) }).summary.truncated, true);
});

test('S1 numbers: a database failure is a 502 with a short message, never raw text', () => {
  const bad = run('score_summary.js', {}, { 'Read runs': { statusCode: 500, body: { message: 'secret db text' } }, 'Read decisions': ok([]) });
  assert.deepEqual([bad.ok, bad.status_code, bad.error], [false, 502, 'database_error']);
  assert.ok(!JSON.stringify(bad).includes('secret'));
});

test('S1 message: one text with the pilot block first, then runs and errors, time, decisions, cost, health checks', () => {
  const summary = run('score_summary.js', {}, { 'Read runs': ok(runs), 'Read decisions': ok(decisions), 'Read pilot numbers': ok({ numbers: { missed_day: 0, on_time_pct: 90, gap_share: 0.1, orders_day: 12 }, breakpoints: { missed_day: 1, on_time_pct: 80, gap_share: 0.2, orders_day: 30 } }) });
  const m = run('score_message.js', summary, { Config: { chat_id: '42' }, 'Prepare window': { until_label: '2026-10-14 22:15', period_label: 'last 24 hours' } });
  assert.equal(m.chat_id, '42');
  const lines = m.text.split('\n');
  assert.equal(lines[0], 'GoServe pilot day card, last 24 hours (to 2026-10-14 22:15 India time)');
  assert.ok(m.text.indexOf('Missed tickets') < m.text.indexOf('Runs: 4'));
  assert.ok(lines.includes('Runs: 4, errors: 1 (25%)'));
  assert.ok(lines.includes('Time per run: 425 ms on average, 900 ms at most'));
  assert.ok(lines.includes('Decisions: 3. Jev advice used: 2, agreed with the rule: 1'));
  assert.ok(lines.includes('Cost of all calls: $0.00010 (about $0.00003 per decision)'));
  assert.ok(lines.includes('Health checks: 1'));
});

test('S1 message: an empty day says so, a failed read says so, a cut page says so', () => {
  const named = { Config: { chat_id: '42' }, 'Prepare window': { until_label: '2026-10-14 22:15', period_label: 'last 24 hours' } };
  const empty = run('score_summary.js', {}, { 'Read runs': ok([]), 'Read decisions': ok([]) });
  assert.match(run('score_message.js', empty, named).text, /No runs in the last 24 hours\./);
  const failed = run('score_message.js', { ok: false, status_code: 502, error: 'database_error', message: 'Something went wrong.' }, named).text;
  assert.match(failed, /could not read the numbers/);
  const cut = run('score_summary.js', {}, { 'Read runs': ok(Array.from({ length: 1000 }, () => ({ workflow: 'w', duration_ms: 1, cost: 0, error: '' }))), 'Read decisions': ok([]) });
  assert.match(run('score_message.js', cut, named).text, /latest 1000 runs only/);
});

test('wiring: MAIN 90 is a schedule at 22:15 India time; Config, kill switch, window, SUB 91, message, Telegram, then the ping history is pruned', () => {
  const c = wf.main90.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual(next('Every day 22:15'), ['Config']);
  assert.deepEqual(next('Config'), ['Kill switch?']);
  assert.deepEqual([next('Kill switch?', 0), next('Kill switch?', 1)], [['Paused'], ['Prepare window']]);
  assert.deepEqual(next('Prepare window'), ['Call SUB 91 Scorecard numbers']);
  assert.deepEqual(next('Call SUB 91 Scorecard numbers'), ['Call SUB 94 Health and cost numbers']);   // #488
  assert.deepEqual(next('Call SUB 94 Health and cost numbers'), ['Format message']);
  assert.deepEqual(next('Format message'), ['Send scorecard']);
  assert.deepEqual(next('Send scorecard').sort(), ['Limit alert', 'Prune ping history']);
  assert.match(byName(wf.main90, 'Prune ping history').parameters.url, /rpc\/pilot_prune/);
  assert.equal(wf.main90.settings.timezone, 'Asia/Kolkata');
  assert.deepEqual(byName(wf.main90, 'Every day 22:15').parameters.rule.interval[0], { field: 'cronExpression', expression: '15 22 * * *' });
  assert.equal(wf.main90.settings.errorWorkflow, 'ALERT1');
});

test('wiring: the message goes to the owner chat through the GoServeBot credential, one message, plain text', () => {
  const t = byName(wf.main90, 'Send scorecard');
  assert.equal(t.type, 'n8n-nodes-base.telegram');
  assert.equal(t.credentials.telegramApi.name, 'GoServeBot');
  assert.equal(t.parameters.chatId, '={{ $json.chat_id }}');
  assert.equal(t.parameters.text, '={{ $json.text }}');
  assert.equal(t.parameters.additionalFields.parse_mode, undefined);
  assert.equal(byName(wf.main90, 'Config').parameters.assignments.assignments.find((a) => a.name === 'chat_id').value, '42');
});

test('wiring: SUB 91 only reads (GET, plus the read-only pilot_numbers function), is called by MAIN 90 and MAIN 93, and has the declared inputs', () => {
  const reads = wf.sub91.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.deepEqual(reads.map((n) => n.name), ['Read runs', 'Read decisions', 'Read pilot numbers']);
  for (const n of reads.slice(0, 2)) assert.ok(!n.parameters.method || n.parameters.method === 'GET', n.name);
  const pilot = byName(wf.sub91, 'Read pilot numbers').parameters;
  assert.equal(pilot.method, 'POST');
  assert.match(pilot.url, /\/rest\/v1\/rpc\/pilot_numbers$/);
  assert.match(pilot.jsonBody, /p_since.*p_until/);
  assert.match(byName(wf.sub91, 'Read runs').parameters.url, /\/rest\/v1\/run_log\?.*created_at=gte\.\{\{ \$\('Start'\)\.first\(\)\.json\.since \}\}&created_at=lt\.\{\{ \$\('Start'\)\.first\(\)\.json\.until \}\}&order=created_at\.desc&limit=1000/);
  assert.match(byName(wf.sub91, 'Read decisions').parameters.url, /\/rest\/v1\/decision_log\?/);
  assert.equal(wf.sub91.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(wf.sub91.settings.callerIds, 'MAIN90,MAIN93');
  for (const c of ['Call SUB 91 Scorecard numbers']) {
    const call = byName(wf.main90, c).parameters;
    assert.equal(call.workflowId.value, 'SUB91');
    const declared = byName(wf.sub91, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
    assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
  }
});

test('no secret or project address in the build; the database address comes in at deploy time', () => {
  const all = JSON.stringify([wf.main90, wf.sub91, wf.main92, wf.sub93, wf.main93]);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(all) && !/tmxyizmkpwwfyazvrfhw/.test(all));
});

for (const key of ['sub91', 'main90', 'sub93', 'main92', 'main93']) {
  test(`canvas layout ${key}: boxes, gaps, text band, flow left to right (B12.5)`, () => {
    assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
  });
}

// ---- Story #263: the daily card says which engine made the day's decisions. ----
test('#263 the summary counts decisions by engine and the card prints one Engine line', () => {
  const rows = [{ decision: { engine: 'rules', jev_status: 'engine_rules' } }, { decision: { engine: 'rules', jev_status: 'engine_rules' } }, { decision: { engine: 'jev', jev_status: 'ok', jev: { agrees: true } } }, { decision: { jev_status: 'jev_off' } }];
  const r = run('score_summary.js', {}, { 'Read runs': ok([]), 'Read decisions': ok(rows) });
  assert.deepEqual(r.summary.engines, { rules: 2, jev: 1, laya: 0, older: 1 });
  const named = { Config: { chat_id: '42' }, 'Prepare window': { until_label: '2026-10-14 22:15', period_label: 'last 24 hours' } };
  assert.match(run('score_message.js', r, named).text, /Engine: rules 2, jev 1 \(before the switch: 1\)/);
  const none = run('score_summary.js', {}, { 'Read runs': ok([]), 'Read decisions': ok([]) });
  assert.doesNotMatch(run('score_message.js', none, named).text, /Engine:/);
});
