// Story S-C (#95) tests, written BEFORE the code (red first). The customer's Yes: action `confirm` in MAIN 01, run by SUB 12 through the database function confirm_delivery.
// Lesson of S-B: a new action needs the allow-list in Check token, the Route output and the Call node. The first test checks all three together.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub15: 'SUB15', sub16: 'SUB16', sub17: 'SUB17', sub91: 'SUB91', main90: 'MAIN90', alert: 'ALERT1' };
const wf = build({ ids: IDS });
const UUID = '11111111-1111-1111-1111-111111111111';
const ORDER = '22222222-2222-2222-2222-222222222222';
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, json, others = {}) => new Function('$input', '$', src(file))({ first: () => ({ json }) }, (n) => ({ first: () => ({ json: others[n] }), isExecuted: n in others }))[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => ((w.connections[n] || { main: [] }).main[i] || []).map((x) => x.node);

test('S3 (story #940) the customer\'s Yes is not served by the webhook any more: Check token marks `confirm` as bad, so Route sends it to 400', () => {
  const token = run('check_token.js', { demo_token: 't', headers: { 'x-gs-token': 't' }, body: { action: 'confirm' }, kill_switch: false, supabase_url: 'u', params_version: 1, kitchen_id: UUID });
  assert.equal(token.action, 'bad');
});

test('Guard (SUB 12): `confirm` picks confirm_delivery with only the order and the session; any other status still picks change_status', () => {
  const base = { kill_switch: false, supabase_url: 'u', session_id: 's1', order_id: ORDER, actor: 'customer' };
  const c = run('guard_status.js', { ...base, to_status: 'confirm' });
  assert.deepEqual([c.ok, c.rpc_fn, c.rpc_body], [true, 'confirm_delivery', { p_order: ORDER, p_session: 's1' }]);
  const s = run('guard_status.js', { ...base, to_status: 'accepted', actor: 'kitchen' });
  assert.deepEqual([s.rpc_fn, s.rpc_body], ['change_status', { p_order: ORDER, p_session: 's1', p_to: 'accepted', p_actor: 'kitchen' }]);
  assert.equal(run('guard_status.js', { ...base, to_status: 'confirm', actor: 'kitchen' }).status_code, 400);   // only the customer confirms
  assert.equal(run('guard_status.js', { ...base, to_status: 'confirm', kill_switch: true }).status_code, 503);
});

test('SUB 12 calls the database function the Guard chose', () => {
  assert.match(byName(wf.sub12, 'Change status').parameters.url, /rpc\/\{\{ \$json\.rpc_fn \}\}/);
  assert.match(byName(wf.sub11, 'Place order').parameters.url, /rpc\/place_order$/);   // the others stay fixed
});

test('Shape result: a repeat Yes is 200 already_done with the order; the same step twice is 409 already_done', () => {
  const order = { id: ORDER, status: 'delivered', paid_by: 'cash' };
  const r = run('shape.js', { statusCode: 200, body: { already_done: true, order } });
  assert.deepEqual([r.ok, r.status_code, r.already_done, r.order], [true, 200, true, order]);
  const first = run('shape.js', { statusCode: 200, body: { order } });
  assert.equal(first.already_done, undefined);
  const dup = run('shape.js', { statusCode: 400, body: { code: 'P0001', message: 'already_done' } });
  assert.deepEqual([dup.ok, dup.status_code, dup.error], [false, 409, 'already_done']);
  const early = run('shape.js', { statusCode: 400, body: { code: 'P0001', message: 'illegal status step: placed to delivered' } });
  assert.deepEqual([early.status_code, early.error], [409, 'illegal_step']);
});

test('Config holds the two prompt times, and the answer returns them to the phone', () => {
  const cfg = byName(wf.main01, 'Config').parameters.assignments.assignments;
  assert.equal(cfg.find((a) => a.name === 'confirm_after_ready_min').value, 3);
  assert.equal(cfg.find((a) => a.name === 'confirm_after_place_min').value, 8);
  const body = byName(wf.main01, 'Respond result').parameters.responseBody;
  assert.match(body, /already_done: \$json\.already_done/);
  assert.match(body, /confirm_after_ready_min: \$\('Config'\)\.first\(\)\.json\.confirm_after_ready_min/);
  assert.match(body, /confirm_after_place_min: \$\('Config'\)\.first\(\)\.json\.confirm_after_place_min/);
});

test('layout and safety still hold', () => {
  for (const key of ['sub12', 'main01']) assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
  assert.equal(byName(wf.sub12, 'Change status').continueOnFail, undefined);
});
