// Story H5 (#188) tests, written BEFORE the code (red first): GS MAIN 30 Simulator (seed and reset API) and GS SUB 30 Simulator write.
// Run: node --test ops/n8n/order/sim.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub30: 'SUB30', main30: 'MAIN30', alert: 'ALERT1' };
const wf = build({ ids: IDS, chatId: '42', simToken: 'SIMTOKEN' });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, input) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, () => { throw new Error('no named node in a SUB'); })[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);

test('H5 the token check accepts only the sim token in x-gs-sim-token and only seed or reset', () => {
  const ok = run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'seed' }, sim_token: 'S', kill_switch: false, supabase_url: 'u' });
  assert.equal(ok.token_ok, true); assert.equal(ok.action, 'seed');
  assert.equal(run('sim_token.js', { headers: { 'x-gs-token': 'S' }, body: { action: 'seed' }, sim_token: 'S' }).token_ok, false);   // the demo token header is not enough
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'tick' }, sim_token: 'S' }).action, 'bad');
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': '' }, body: { action: 'reset' }, sim_token: '' }).token_ok, false);   // an empty token never matches
});

test('H5 the guard fills defaults, clamps the numbers and picks the database function', () => {
  const seed = run('guard_sim.js', { action: 'seed', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.deepEqual(seed, { ok: true, supabase_url: 'u', rpc_fn: 'sim_seed', rpc_body: { p: { kitchens: 10, riders: 20, dishes_per_kitchen: 6, seed: 42, open_pct: 80, online_pct: 70 } } });
  const big = run('guard_sim.js', { action: 'seed', body: { kitchens: 9999, riders: -3, dishes_per_kitchen: '4', seed: 7, open_pct: 150 }, kill_switch: false, supabase_url: 'u' });
  assert.deepEqual(big.rpc_body.p, { kitchens: 50, riders: 1, dishes_per_kitchen: 4, seed: 7, open_pct: 100, online_pct: 70 });
  const reset = run('guard_sim.js', { action: 'reset', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.equal(reset.rpc_fn, 'sim_reset'); assert.deepEqual(reset.rpc_body, {});
  assert.equal(run('guard_sim.js', { action: 'seed', body: {}, kill_switch: true }).status_code, 503);
  assert.equal(run('guard_sim.js', { action: 'bad', body: {}, kill_switch: false }).status_code, 400);
});

test('H5 MAIN 30 wiring: webhook, Config, token, kill switch, route to SUB 30, respond; the sim token never sits in a node', () => {
  const m = wf.main30;
  assert.equal(byName(m, 'Sim webhook').parameters.path, 'gs-sim');
  assert.deepEqual(next(m, 'Sim webhook'), ['Config']);
  assert.deepEqual(next(m, 'Config'), ['Check token']);
  assert.deepEqual(next(m, 'Token ok?', 0), ['Kill switch?']);
  assert.deepEqual(next(m, 'Token ok?', 1), ['Respond 401']);
  assert.deepEqual(next(m, 'Kill switch?', 0), ['Respond 503']);
  assert.deepEqual(next(m, 'Kill switch?', 1), ['Action ok?']);
  assert.deepEqual(next(m, 'Action ok?', 0), ['Call SUB 30 Simulator write']);
  assert.deepEqual(next(m, 'Action ok?', 1), ['Respond 400']);
  assert.equal(byName(m, 'Call SUB 30 Simulator write').parameters.workflowId.value, 'SUB30');
  assert.deepEqual(next(m, 'Call SUB 30 Simulator write'), ['Respond result']);
  assert.ok(!JSON.stringify(m.nodes.filter((n) => n.name !== 'Config')).includes('SIMTOKEN'), 'the token lives in Config only');
  assert.ok(JSON.stringify(byName(m, 'Config')).includes('SIMTOKEN'));
});

test('H5 SUB 30: only MAIN 30 may call it, the write is the dynamic rpc (sim_seed or sim_reset) with the service credential', () => {
  const s = wf.sub30;
  assert.equal(s.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(s.settings.callerIds, 'MAIN30');
  const http = byName(s, 'Seed or reset');
  assert.equal(http.parameters.url, '={{ $json.supabase_url }}/rest/v1/rpc/{{ $json.rpc_fn }}');
  assert.deepEqual(next(s, 'Allowed?', 0), ['Seed or reset']);
  assert.deepEqual(next(s, 'Allowed?', 1), ['Return refusal']);
});

test('H5 both canvases pass the layout checks (rulebook B12)', () => {
  for (const key of ['sub30', 'main30']) assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
});
