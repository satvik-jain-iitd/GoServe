// Story A5 (#152): a ready order gets a rider. Run: node --test "ops/n8n/order/*.test.js"
// 1) the Code node logic, run exactly as written in code/*.js   2) wiring and contract   3) canvas layout (rulebook B12.5)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub15: 'SUB15', sub19: 'SUB19', sub20: 'SUB20', sub21: 'SUB21', sub22: 'SUB22', alert: 'ALERT1' };
const wf = build({ ids: IDS });
const src = (file) => fs.readFileSync(path.join(__dirname, 'code', file), 'utf8');
// $input is the item that arrives; $ looks a node up by name, as n8n does.
const run = (file, json, nodes = {}) => new Function('$input', '$', src(file))({ first: () => ({ json }) }, (name) => ({ first: () => ({ json: nodes[name] }) }))[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, from, out = 0) => (w.connections[from]?.main[out] || []).map((x) => x.node);
const ORDER = '11111111-1111-4111-8111-111111111111';
const RIDER = '22222222-2222-4222-8222-222222222222';

test('S1 assign guard: a good call becomes an RPC body; bad ids and the kill switch are refused', () => {
  const good = { kill_switch: false, supabase_url: 'u', order_id: ORDER, rider_id: RIDER };
  assert.deepEqual(run('guard_assign.js', good).rpc_body, { p_order: ORDER, p_rider: RIDER });
  for (const bad of [{ order_id: 'nope' }, { rider_id: '' }, { rider_id: undefined }, { order_id: undefined }]) assert.equal(run('guard_assign.js', { ...good, ...bad }).status_code, 400, JSON.stringify(bad));
  const r = run('guard_assign.js', { ...good, kill_switch: true });
  assert.deepEqual([r.ok, r.status_code, r.error], [false, 503, 'kill_switch']);
});

test('S1 riders guard: a good call becomes an RPC body; a bad order id and the kill switch are refused', () => {
  const good = { kill_switch: false, supabase_url: 'u', order_id: ORDER };
  assert.deepEqual(run('guard_riders.js', good).rpc_body, { p_order: ORDER });
  assert.equal(run('guard_riders.js', { ...good, order_id: 'x' }).status_code, 400);
  assert.equal(run('guard_riders.js', { ...good, kill_switch: true }).status_code, 503);
});

test('S1 shape: the rider list passes through; not_ready and rider_not_available are 409s', () => {
  const riders = [{ id: RIDER, free: true, distance_m: 900, trips_done: 2 }];
  assert.deepEqual(run('shape.js', { statusCode: 200, body: { riders } }), { ok: true, status_code: 200, riders });
  for (const m of ['not_ready', 'rider_not_available']) {
    const r = run('shape.js', { statusCode: 400, body: { message: m } });
    assert.deepEqual([r.ok, r.status_code, r.error], [false, 409, m]);
  }
});

test('S2 prepare decision: the candidates become the SUB 13 input, at most ten, nearest first', () => {
  const start = { session_id: 's1', kitchen_id: ORDER, order_id: ORDER, params_version: 3, jev_enabled: true, jev_model: 'm', jev_cost_cap: 0.01, kill_switch: false, supabase_url: 'u' };
  const riders = Array.from({ length: 12 }, (_, i) => ({ id: `22222222-2222-4222-8222-0000000000${String(i).padStart(2, '0')}`, free: true, distance_m: (12 - i) * 100, trips_done: 0 }));
  const r = run('dispatch_prepare.js', { ok: true, riders }, { Start: start });
  assert.equal(r.riders.length, 10);
  assert.deepEqual(r.riders.map((x) => x.distance_m), r.riders.map((x) => x.distance_m).sort((a, b) => a - b));
  assert.deepEqual([r.session_id, r.kitchen_id, r.order_id, r.params_version, r.jev_enabled, r.supabase_url], ['s1', ORDER, ORDER, 3, true, 'u']);
});

test('S2 SUB 13 accepts rider ids that are database ids (36 characters)', () => {
  const j = { kill_switch: false, supabase_url: 'u', session_id: 's1', kitchen_id: ORDER, order_id: ORDER, params_version: 1, jev_enabled: false, riders: [{ id: RIDER, free: true, distance_m: 100, trips_done: 0 }] };
  const r = run('decide_guard.js', j);
  assert.equal(r.ok, true);
  assert.equal(r.rule_pick, RIDER);
});

test('S3 prepare assign: the rule pick is assigned; "none" is not', () => {
  const start = { order_id: ORDER, kill_switch: false, supabase_url: 'u' };
  assert.deepEqual(run('dispatch_assign.js', { ok: true, decision: { chosen_pick: RIDER } }, { Start: start }), { ok: true, order_id: ORDER, rider_id: RIDER, kill_switch: false, supabase_url: 'u' });
  assert.equal(run('dispatch_assign.js', { ok: true, decision: { chosen_pick: 'none' } }, { Start: start }).ok, false);
  assert.equal(run('dispatch_assign.js', { ok: false }, { Start: start }).ok, false);
});

test('wiring: MAIN 01 answers first, then dispatches a ready order through SUB 22', () => {
  assert.deepEqual(next(wf.main01, 'Respond result').sort(), ['Log run', 'Push?', 'Ready?']);
  assert.deepEqual(next(wf.main01, 'Ready?', 0), ['Call SUB 22 Dispatch']);
  assert.equal(next(wf.main01, 'Ready?', 1).length, 0);
  assert.equal(byName(wf.main01, 'Call SUB 22 Dispatch').parameters.workflowId.value, 'SUB22');
  assert.match(byName(wf.main01, 'Ready?').parameters.conditions.conditions[0].leftValue, /status === 'ready'/);
  assert.ok(wf.main01.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length <= 24);
});

test('wiring: SUB 22 asks for riders, decides, assigns once; no rider and no pick stop with an error', () => {
  const w = wf.sub22;
  assert.deepEqual(next(w, 'Start'), ['Call SUB 21 Riders']);
  assert.deepEqual(next(w, 'Call SUB 21 Riders'), ['Riders found?']);
  assert.deepEqual(next(w, 'Riders found?', 0), ['Prepare decision']);
  assert.deepEqual(next(w, 'Riders found?', 1), ['No rider']);
  assert.deepEqual(next(w, 'Prepare decision'), ['Call SUB 13 Decide']);
  assert.deepEqual(next(w, 'Call SUB 13 Decide'), ['Prepare assign']);
  assert.deepEqual(next(w, 'Prepare assign'), ['Rider chosen?']);
  assert.deepEqual(next(w, 'Rider chosen?', 0), ['Call SUB 19 Assign']);
  assert.deepEqual(next(w, 'Rider chosen?', 1), ['No rider']);
  assert.equal(byName(w, 'No rider').type, 'n8n-nodes-base.stopAndError');   // the error workflow tells the owner (ERR 00)
  assert.equal(w.settings.errorWorkflow, 'ALERT1');
});

test('safety: the dispatch SUBs accept calls only from their callers; SUB 13 also from SUB 22', () => {
  assert.equal(wf.sub19.settings.callerIds, 'SUB22');
  assert.equal(wf.sub21.settings.callerIds, 'SUB22');
  assert.equal(wf.sub22.settings.callerIds, 'MAIN1');
  assert.deepEqual(wf.sub13.settings.callerIds.split(',').sort(), ['MAIN1', 'SUB22']);
  for (const k of ['sub19', 'sub21']) {
    const rpc = wf[k].nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest');
    assert.equal(rpc.continueOnFail, undefined);   // B7: no continue on fail on a write path
  }
});

test('names follow the house prefix and numbers', () => {
  assert.deepEqual([wf.sub19.name, wf.sub21.name, wf.sub22.name], ['GS SUB 19 Assign rider', 'GS SUB 21 Dispatch riders', 'GS SUB 22 Dispatch']);
});

for (const key of ['sub19', 'sub21', 'sub22', 'main01']) {
  test(`canvas layout ${key}: boxes, gaps, text band, flow left to right (B12.5)`, () => {
    assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
  });
}

test('deploy: the dispatch SUBs are deployed before MAIN 01 and are never activated by the script', () => {
  const { ORDER: order, NAMES } = require('./deploy');
  for (const k of ['sub19', 'sub21', 'sub22']) assert.ok(order.indexOf(k) > -1 && order.indexOf(k) < order.indexOf('main01'), k);
  assert.ok(order.indexOf('sub22') > order.indexOf('sub19') && order.indexOf('sub22') > order.indexOf('sub21') && order.indexOf('sub22') > order.indexOf('sub13'));
  assert.deepEqual([NAMES.sub19, NAMES.sub21, NAMES.sub22], [wf.sub19.name, wf.sub21.name, wf.sub22.name]);
});

test('S6 shape: a closed kitchen is a 409 with its own code (story A6)', () => {
  const r = run('shape.js', { statusCode: 400, body: { message: 'kitchen_closed' } });
  assert.deepEqual([r.ok, r.status_code, r.error], [false, 409, 'kitchen_closed']);
  assert.match(r.message, /closed/);
});
