// Story H5 (#188) tests, written BEFORE the code (red first): GS MAIN 30 Simulator (seed and reset API) and GS SUB 30 Simulator write.
// Run: node --test ops/n8n/order/sim.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub30: 'SUB30', main30: 'MAIN30', main31: 'MAIN31', alert: 'ALERT1' };
const wf = build({ ids: IDS, chatId: '42', simToken: 'SIMTOKEN' });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, input) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, () => { throw new Error('no named node in a SUB'); })[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);

test('H5 the token check accepts only the sim token in x-gs-sim-token and only seed or reset', () => {
  const ok = run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'seed' }, sim_token: 'S', kill_switch: false, supabase_url: 'u' });
  assert.equal(ok.token_ok, true); assert.equal(ok.action, 'seed');
  assert.equal(run('sim_token.js', { headers: { 'x-gs-token': 'S' }, body: { action: 'seed' }, sim_token: 'S' }).token_ok, false);   // the demo token header is not enough
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'fly' }, sim_token: 'S' }).action, 'bad');
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': '' }, body: { action: 'reset' }, sim_token: '' }).token_ok, false);   // an empty token never matches
});

test('H5 the guard fills defaults, clamps the numbers and picks the database function', () => {
  const seed = run('guard_sim.js', { action: 'seed', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.deepEqual(seed, { ok: true, supabase_url: 'u', rpc_fn: 'sim_seed', rpc_body: { p: { riders_per_kitchen: 4, online_pct: 70 } } });
  const big = run('guard_sim.js', { action: 'seed', body: { riders_per_kitchen: 9999, online_pct: -5 }, kill_switch: false, supabase_url: 'u' });
  assert.deepEqual(big.rpc_body.p, { riders_per_kitchen: 20, online_pct: 0 });
  const knobs = run('guard_sim.js', { action: 'knobs', body: { reject_pct: 12, sold_out_pct: 'x', delay_pct: 250, rider_drop_pct: 3 }, kill_switch: false, supabase_url: 'u' });   // #284: the four scenario knobs
  assert.equal(knobs.rpc_fn, 'sim_set_knobs');
  assert.deepEqual(knobs.rpc_body.p, { reject_pct: 12, sold_out_pct: 3, delay_pct: 100, rider_drop_pct: 3 });   // a bad number falls back to the default; over 100 clamps
  const reset = run('guard_sim.js', { action: 'reset', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.equal(reset.rpc_fn, 'sim_reset'); assert.deepEqual(reset.rpc_body, {});
  assert.equal(run('guard_sim.js', { action: 'seed', body: {}, kill_switch: true }).status_code, 503);
  assert.equal(run('guard_sim.js', { action: 'bad', body: {}, kill_switch: false }).status_code, 400);
});

test('#284 the token check lets the knobs action through', () => {
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'knobs' }, sim_token: 'S' }).action, 'knobs');
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
  const rr = byName(m, 'Respond result').parameters;   // the body is a JSON string and the code the SUB's status_code, exactly like MAIN 01 (prod 502 on 25 Oct with an object body)
  assert.equal(rr.responseBody, '={{ JSON.stringify($json) }}');
  assert.equal(rr.options.responseCode, '={{ $json.status_code }}');
  assert.equal(rr.respondWith, 'json');
  assert.ok(!JSON.stringify(m.nodes.filter((n) => n.name !== 'Config')).includes('SIMTOKEN'), 'the token lives in Config only');
  assert.ok(JSON.stringify(byName(m, 'Config')).includes('SIMTOKEN'));
});

test('H5 SUB 30: only MAIN 30 may call it, the write is the dynamic rpc (sim_seed or sim_reset) with the service credential', () => {
  const s = wf.sub30;
  assert.equal(s.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(s.settings.callerIds, 'MAIN30,MAIN31');   // H6: the tick schedule calls it too
  const http = byName(s, 'Seed or reset');
  assert.equal(http.parameters.url, '={{ $json.supabase_url }}/rest/v1/rpc/{{ $json.rpc_fn }}');
  assert.deepEqual(next(s, 'Allowed?', 0), ['Seed or reset']);
  assert.deepEqual(next(s, 'Allowed?', 1), ['Return refusal']);
});

test('H5 both canvases pass the layout checks (rulebook B12)', () => {
  for (const key of ['sub30', 'main30']) assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
});

// ---- Story H6 (#189): the tick. Every minute while sim_enabled, synthetic riders move, some kitchens and dishes flip. Only synthetic rows. ----
test('H6 the guard knows tick, enable and disable, with clamped movement numbers', () => {
  const tick = run('guard_sim.js', { action: 'tick', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.equal(tick.rpc_fn, 'sim_tick');
  assert.deepEqual(tick.rpc_body, { p: { move_min_m: 100, move_max_m: 300, kitchen_flip_pct: 2, dish_flip_pct: 5, rider_flip_pct: 2 } });   // H7: 2 % (review Q1), riders flip too (Q2)
  const far = run('guard_sim.js', { action: 'tick', body: { move_min_m: 50, move_max_m: 99999, kitchen_flip_pct: -1, dish_flip_pct: 500 }, kill_switch: false, supabase_url: 'u' });
  assert.deepEqual(far.rpc_body.p, { move_min_m: 50, move_max_m: 2000, kitchen_flip_pct: 0, dish_flip_pct: 100, rider_flip_pct: 2 });
  assert.deepEqual(run('guard_sim.js', { action: 'enable', body: {}, kill_switch: false, supabase_url: 'u' }).rpc_body, { p: { enabled: true } });
  const off = run('guard_sim.js', { action: 'disable', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.equal(off.rpc_fn, 'sim_enable'); assert.deepEqual(off.rpc_body, { p: { enabled: false } });
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'enable' }, sim_token: 'S' }).action, 'enable');
});

test('H6 MAIN 31 wiring: a schedule every minute, Config, kill switch, then SUB 30 with action tick; nothing else', () => {
  const m = wf.main31;
  assert.equal(byName(m, 'Every minute').type, 'n8n-nodes-base.scheduleTrigger');
  assert.equal(byName(m, 'Every minute').parameters.rule.interval[0].expression, '* * * * *');
  assert.deepEqual(next(m, 'Every minute'), ['Config']);
  assert.deepEqual(next(m, 'Config'), ['Kill switch?']);
  assert.deepEqual(next(m, 'Kill switch?', 0), ['Paused']);
  assert.deepEqual(next(m, 'Kill switch?', 1), ['Tick']);
  assert.deepEqual(next(m, 'Tick'), ['Call SUB 30 Simulator write']);
  assert.equal(byName(m, 'Call SUB 30 Simulator write').parameters.workflowId.value, 'SUB30');
  assert.equal(byName(m, 'Call SUB 30 Simulator write').parameters.workflowInputs.value.action, "={{ $json.action }}");
  assert.equal(run('sim_tick.js', { kill_switch: false, supabase_url: 'u' }).action, 'tick');
  assert.equal(m.settings.errorWorkflow, 'ALERT1');
  assert.deepEqual(checkLayout(m, m.sections), []);
});

// ---- Story H7 (#190): the admin Simulator tab asks "status" through the same webhook; MAIN 31 keeps no successful runs (review Q3). ----
test('H7 the guard knows status (sim_status, no body) and the token check lets it through', () => {
  const st = run('guard_sim.js', { action: 'status', body: {}, kill_switch: false, supabase_url: 'u' });
  assert.equal(st.rpc_fn, 'sim_status'); assert.deepEqual(st.rpc_body, {});
  assert.equal(run('sim_token.js', { headers: { 'x-gs-sim-token': 'S' }, body: { action: 'status' }, sim_token: 'S' }).action, 'status');
});

test('H7 MAIN 31 saves no successful execution, errors still go to GS ERR 00', () => {
  assert.equal(wf.main31.settings.saveDataSuccessExecution, 'none');
  assert.equal(wf.main31.settings.saveDataErrorExecution, 'all');
  assert.equal(wf.main31.settings.errorWorkflow, 'ALERT1');
});

// ---- Prod bug, 25 Oct 2026: SUB 30's "Shape result" (shape.js) knew only order and rider answers, so every good sim_* answer became a 502 database_error. ----
test('H7 fix: the shape node passes a good sim answer through with its counts and a 200', () => {
  const seed = run('shape.js', { statusCode: 200, body: { ok: true, seed: 42, kitchens: 10, kitchens_open: 8, riders: 20, riders_online: 14, dishes: 60 } });
  assert.deepEqual(seed, { ok: true, status_code: 200, seed: 42, kitchens: 10, kitchens_open: 8, riders: 20, riders_online: 14, dishes: 60 });
  assert.equal(run('shape.js', { statusCode: 200, body: { ok: true, enabled: true } }).enabled, true);
  assert.equal(run('shape.js', { statusCode: 200, body: { ok: true, skipped: 'sim_disabled' } }).status_code, 200);
  assert.equal(run('shape.js', { statusCode: 200, body: { ok: true, riders_moved: 14, kitchens_flipped: 1, dishes_flipped: 2, riders_flipped: 1 } }).riders_moved, 14);
});

test('H7 fix: a database refusal on a sim call is still a 502 with no raw text, and an order answer is unchanged', () => {
  const bad = run('shape.js', { statusCode: 400, body: { message: 'permission denied for function sim_seed' } });
  assert.equal(bad.status_code, 502); assert.equal(bad.message, 'Something went wrong. Please try again.');
  assert.equal(run('shape.js', { statusCode: 200, body: { order: { id: 'o1' }, created: true } }).status_code, 201);
  assert.equal(run('shape.js', { statusCode: 200, body: { riders: [{ id: 'r1' }] } }).riders.length, 1);
});

test('H7 fix: the 400 text of MAIN 30 names all six actions', () => {
  assert.match(byName(wf.main30, 'Respond 400').parameters.responseBody, /seed, reset, tick, enable, disable or status/);
});

// ---- Story #454: demo mode is one more key on the knobs action; a call without it must not touch the switch ----
test('#454 the knobs action passes demo only when it is a real boolean', () => {
  const on = run('guard_sim.js', { action: 'knobs', body: { reject_pct: 0, demo: true }, kill_switch: false, supabase_url: 'u' });
  assert.equal(on.rpc_body.p.demo, true);
  const off = run('guard_sim.js', { action: 'knobs', body: { demo: false }, kill_switch: false, supabase_url: 'u' });
  assert.equal(off.rpc_body.p.demo, false);
  for (const demo of [undefined, 'yes', 1, null]) {
    const p = run('guard_sim.js', { action: 'knobs', body: { demo }, kill_switch: false, supabase_url: 'u' }).rpc_body.p;
    assert.equal('demo' in p, false);
  }
});
