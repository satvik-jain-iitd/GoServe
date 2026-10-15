// Story #54 tests, written BEFORE the code (red first): SUB 16 Health, one tiny Jev call so the founder sees Jev answer before the demo.
// Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub15: 'SUB15', sub16: 'SUB16', alert: 'ALERT1' };
const wf = build({ ids: IDS });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, json, prev = {}) => new Function('$input', '$', src(file))({ first: () => ({ json }) }, () => ({ first: () => ({ json: prev }) }))[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
// The shape OpenRouter's decisions endpoint answered on 15 Oct 2026 for a yes/no question.
const reply = (noul, cost = 0.00002) => ({ statusCode: 200, body: { model: 'typesafe/jev-1.13', provider: 'TypeSafe', answers: { sky: { type: 'noul', noul } }, usage: { input_tokens: 298, output_tokens: 20, cost } } });

test('S1 SUB 16: Jev is asked one tiny question with the pinned model, and not asked when it is off', () => {
  const on = run('health_prepare.js', { jev_enabled: true, jev_model: 'typesafe/jev-1.13' });
  assert.deepEqual([on.use_jev, on.jev_body.model], [true, 'typesafe/jev-1.13']);
  assert.deepEqual(Object.keys(on.jev_body.questions), ['sky']);
  assert.equal(on.jev_body.questions.sky.type, 'noul');
  assert.deepEqual(Object.keys(on.jev_body.questions.sky.criteria), ['true', 'false']);
  assert.equal(on.jev_body.messages, undefined);
  assert.equal(typeof on.started_at, 'number');
  assert.equal(run('health_prepare.js', { jev_enabled: false, jev_model: 'x' }).use_jev, false);
});

test('S1 SUB 16: a good Jev reply is OK with its time; every failure says why and is still a 200 answer', () => {
  const at = { use_jev: true, options: ['yes', 'no'], started_at: Date.now() - 250 };
  const ok = run('health_result.js', reply(0.85), at);
  assert.deepEqual([ok.ok, ok.status_code, ok.jev.ok, ok.jev.status], [true, 200, true, 'ok']);
  assert.ok(ok.jev.ms >= 250 && ok.jev.ms < 5000);
  const bad = (res) => run('health_result.js', res, at).jev;
  assert.deepEqual([bad({ error: 'timeout' }).ok, bad({ error: 'timeout' }).status], [false, 'jev_error']);
  assert.equal(bad({ statusCode: 500, body: {} }).status, 'jev_error');
  assert.equal(bad({ statusCode: 200, body: '<html>oops</html>' }).status, 'jev_bad_reply');
  assert.equal(bad(reply('yes')).status, 'jev_bad_reply');   // not a number
  assert.equal(bad(reply(1.5)).status, 'jev_bad_reply');   // outside 0 to 1
  assert.equal(bad({ statusCode: 200, body: { answers: {} } }).status, 'jev_bad_reply');
  const off = run('health_result.js', {}, { use_jev: false, started_at: Date.now() });
  assert.deepEqual([off.jev.ok, off.jev.status], [false, 'jev_off']);
});

test('S1 SUB 16 writes nothing and returns the cost of its one call', () => {
  const r = run('health_result.js', reply(0.9, 0.00003), { use_jev: true, options: ['yes', 'no'], started_at: Date.now() });
  assert.equal(r.cost, 0.00003);
  assert.ok(!wf.sub16.nodes.some((n) => /supabase|rest\/v1/.test(JSON.stringify(n.parameters))));
});

test('check token: health is a known action', () => {
  assert.equal(run('check_token.js', { demo_token: 'a', headers: { 'x-gs-token': 'a' }, body: { action: 'health' } }).action, 'health');
});

test('wiring: MAIN 01 routes health to SUB 16, unknown goes to 400, and the answer carries jev', () => {
  const c = wf.main01.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual([next('Route', 4), next('Route', 7)], [['Call SUB 16 Health'], ['Respond 400']]);
  assert.deepEqual(next('Call SUB 16 Health'), ['Respond result']);
  const call = byName(wf.main01, 'Call SUB 16 Health').parameters;
  assert.equal(call.workflowId.value, 'SUB16');
  const declared = byName(wf.sub16, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
  assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
  assert.match(byName(wf.main01, 'Respond result').parameters.responseBody, /jev: \$json\.jev/);
});

test('wiring: SUB 16 is called only by MAIN 01; only the Jev call continues on error', () => {
  assert.equal(wf.sub16.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(wf.sub16.settings.callerIds, 'MAIN1');
  assert.equal(wf.sub16.settings.errorWorkflow, 'ALERT1');
  const cont = wf.sub16.nodes.filter((n) => n.onError === 'continueRegularOutput').map((n) => n.name);
  assert.deepEqual(cont, ['Ask Jev']);
  const jev = byName(wf.sub16, 'Ask Jev');
  assert.equal(jev.parameters.options.timeout, 3000);
  assert.equal(jev.parameters.url, 'https://openrouter.ai/api/alpha/decisions');
});

test('the health call is logged like the other calls', () => {
  const r = run('log_run.js', { ok: true, cost: 0 }, { body: { session_id: 's1' }, action: 'health', started_at: Date.now() - 5, kitchen_id: 'k', params_version: 1, supabase_url: 'u' });
  assert.equal(r.workflow, 'GS MAIN 01 Order API: health');
});

test('canvas layout sub16: boxes, gaps, text band, flow left to right (B12.5)', () => {
  assert.deepEqual(checkLayout(wf.sub16, wf.sub16.sections), []);
});
