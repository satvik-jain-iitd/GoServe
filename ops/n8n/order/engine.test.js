// Story #263 layer 1: the admin picks the decision engine through n8n with their own sign-in (GS MAIN 32 Decision engine, GS SUB 32 Engine call).
// The database decides who is an admin (is_admin on the caller's JWT); n8n holds no admin token and the app holds no secret. Run: node --test ops/n8n/order/engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub13: 'SUB13', sub22: 'SUB22', sub32: 'SUB32', main32: 'MAIN32', alert: 'ALERT1' };
const wf = build({ ids: IDS, anonKey: 'ANONKEY' });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, input) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, () => { throw new Error('no named node here'); })[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2ln';
const cfg = { kill_switch: false, supabase_url: 'u', anon_key: 'ANON' };

test('#263 the request check wants a Bearer token in JWT shape and a known action', () => {
  const ok = run('engine_check.js', { ...cfg, headers: { authorization: 'Bearer ' + JWT }, body: { action: 'get' } });
  assert.deepEqual([ok.auth_ok, ok.action, ok.auth], [true, 'get', 'Bearer ' + JWT]);
  for (const h of [undefined, '', 'Bearer', 'Bearer abc', 'Basic ' + JWT, JWT, 'Bearer ' + JWT + 'x'.repeat(5000)]) {
    assert.equal(run('engine_check.js', { ...cfg, headers: h === undefined ? {} : { authorization: h }, body: { action: 'get' } }).auth_ok, false, String(h).slice(0, 20));
  }
  const set = run('engine_check.js', { ...cfg, headers: { authorization: 'Bearer ' + JWT }, body: { action: 'set', engine: 'jev' } });
  assert.deepEqual([set.action, set.engine], ['set', 'jev']);
  for (const body of [{ action: 'set' }, { action: 'set', engine: 'gpt' }, { action: 'set', engine: 5 }, { action: 'drop' }, {}]) {
    assert.equal(run('engine_check.js', { ...cfg, headers: { authorization: 'Bearer ' + JWT }, body }).action, 'bad', JSON.stringify(body));
  }
  assert.equal(run('engine_check.js', { ...cfg, kill_switch: true, headers: {}, body: {} }).kill_switch, true);
});

test('#263 SUB 32 guard: kill switch first, then one database function with only the engine as input', () => {
  const g = (over) => run('guard_engine.js', { action: 'get', engine: '', auth: 'Bearer ' + JWT, kill_switch: false, supabase_url: 'u', anon_key: 'A', ...over });
  assert.equal(g({ kill_switch: true }).status_code, 503);
  assert.equal(g({ action: 'drop' }).status_code, 400);
  const get = g({});
  assert.deepEqual([get.ok, get.rpc_fn, get.rpc_body, get.auth, get.anon_key], [true, 'get_decision_engine', {}, 'Bearer ' + JWT, 'A']);
  const set = g({ action: 'set', engine: 'jev' });
  assert.deepEqual([set.rpc_fn, set.rpc_body], ['set_decision_engine', { p_engine: 'jev' }]);
  assert.equal(g({ action: 'set', engine: 'x' }).status_code, 400);
});

test('#263 SUB 32 shape: the answer passes through; each database refusal has a short code and no raw text', () => {
  const sh = (statusCode, body) => run('engine_shape.js', { statusCode, body });
  assert.deepEqual(sh(200, { ok: true, engine: 'jev', version: 2, by: 'a@b.c' }), { ok: true, status_code: 200, engine: 'jev', version: 2, by: 'a@b.c' });
  assert.equal(sh(400, { message: 'not_admin' }).status_code, 403);
  assert.equal(sh(400, { message: 'laya_not_deployed' }).status_code, 409);
  assert.match(sh(400, { message: 'laya_not_deployed' }).message, /not deployed/i);
  assert.equal(sh(400, { message: 'invalid_engine' }).status_code, 400);
  assert.equal(sh(401, { code: 'PGRST301', message: 'JWT expired' }).status_code, 401);
  const raw = sh(500, { message: 'relation "params" does not exist' });
  assert.deepEqual([raw.status_code, raw.message], [502, 'Something went wrong. Please try again.']);
});

test('#263 MAIN 32 wiring: webhook, Config, request check, signed in, kill switch, action, SUB 32, respond', () => {
  const m = wf.main32;
  assert.equal(byName(m, 'Engine webhook').parameters.path, 'gs-engine');
  assert.deepEqual(next(m, 'Engine webhook'), ['Config']);
  assert.deepEqual(next(m, 'Config'), ['Check request']);
  assert.deepEqual(next(m, 'Check request'), ['Signed in?']);
  assert.deepEqual([next(m, 'Signed in?', 0), next(m, 'Signed in?', 1)], [['Kill switch?'], ['Respond 401']]);
  assert.deepEqual([next(m, 'Kill switch?', 0), next(m, 'Kill switch?', 1)], [['Respond 503'], ['Action ok?']]);
  assert.deepEqual([next(m, 'Action ok?', 0), next(m, 'Action ok?', 1)], [['Call SUB 32 Engine'], ['Respond 400']]);
  assert.equal(byName(m, 'Call SUB 32 Engine').parameters.workflowId.value, 'SUB32');
  assert.deepEqual(next(m, 'Call SUB 32 Engine'), ['Respond result']);
  const rr = byName(m, 'Respond result').parameters;
  assert.deepEqual([rr.responseBody, rr.options.responseCode], ['={{ JSON.stringify($json) }}', '={{ $json.status_code }}']);
  const text = JSON.stringify(m);
  assert.ok(!/sim_token|demo_token|SIMTOKEN|x-gs-token|x-gs-sim-token/.test(text), 'no build-time token in this workflow');
  assert.ok(JSON.stringify(byName(m, 'Config')).includes('ANONKEY'), 'the public anon key lives in Config');
  assert.equal(m.settings.errorWorkflow, 'ALERT1');
});

test('#263 SUB 32 forwards the caller JWT and holds no stored credential; only MAIN 32 may call it', () => {
  const s = wf.sub32;
  assert.equal(s.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(s.settings.callerIds, 'MAIN32');
  const http = byName(s, 'Engine rpc');
  assert.equal(http.parameters.authentication, 'none');
  assert.equal(http.credentials, undefined);
  assert.equal(http.parameters.url, '={{ $json.supabase_url }}/rest/v1/rpc/{{ $json.rpc_fn }}');
  const h = Object.fromEntries(http.parameters.headerParameters.parameters.map((p) => [p.name, p.value]));
  assert.deepEqual(h, { Authorization: '={{ $json.auth }}', apikey: '={{ $json.anon_key }}' });
  assert.deepEqual([next(s, 'Allowed?', 0), next(s, 'Allowed?', 1)], [['Engine rpc'], ['Return refusal']]);
  assert.deepEqual(next(s, 'Engine rpc'), ['Shape result']);
  assert.ok(src('guard_engine.js').length > 0 && !/console\.log/.test(src('guard_engine.js')), 'the token is never logged');
});

test('#263 SUB 13 is still callable by MAIN 01 and SUB 22 only', () => {
  assert.deepEqual(wf.sub13.settings.callerIds.split(','), ['MAIN1', 'SUB22']);
});

for (const key of ['sub13', 'sub32', 'main32']) {
  test(`#263 canvas layout ${key}`, () => assert.deepEqual(checkLayout(wf[key], wf[key].sections), []));
}

// Review of #270: the admin's token rides through these two workflows as an item field, so n8n must not keep their execution data.
test('#263 MAIN 32 and SUB 32 save no execution data, success or error; errors still reach GS ERR 00', () => {
  for (const w of [wf.main32, wf.sub32]) {
    assert.equal(w.settings.saveDataSuccessExecution, 'none');
    assert.equal(w.settings.saveDataErrorExecution, 'none');
    assert.equal(w.settings.errorWorkflow, 'ALERT1');
  }
});
