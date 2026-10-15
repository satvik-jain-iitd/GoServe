// Story #45 tests. Run: node --test "ops/n8n/order/*.test.js"
// These were written with the code, not before it. The check that they bite (each made one test fail, 14 Oct 2026):
//   1) code/shape.js: change out(409 to out(200   2) code/guard_place.js: replace j.kill_switch === true with false   3) lib/layout.js: GAP 200 to 100.
// 1) the Code node logic, run exactly as written in code/*.js   2) wiring and contract   3) canvas layout (rulebook B12.5)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, PLACEHOLDER } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12' };
const wf = build({ ids: { ...IDS, sub15: 'SUB15', alert: 'ALERT1' } });
const run = (file, json) => new Function('$input', fs.readFileSync(path.join(__dirname, 'code', file), 'utf8'))({ first: () => ({ json }) })[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const UUID = '11111111-1111-1111-1111-111111111111';

test('S1 token: the right token passes; wrong, missing or unset token does not', () => {
  const cfg = { demo_token: 'abc', kill_switch: false, supabase_url: 'u', headers: { 'x-gs-token': 'abc' }, body: { action: 'place' } };
  assert.equal(run('check_token.js', cfg).token_ok, true);
  assert.equal(run('check_token.js', { ...cfg, headers: { 'x-gs-token': 'nope' } }).token_ok, false);
  assert.equal(run('check_token.js', { ...cfg, headers: {} }).token_ok, false);
  assert.equal(run('check_token.js', { ...cfg, headers: undefined }).token_ok, false);
  assert.equal(run('check_token.js', { ...cfg, demo_token: '', headers: { 'x-gs-token': '' } }).token_ok, false);
  assert.equal(run('check_token.js', { ...cfg, demo_token: undefined, headers: {} }).token_ok, false);
});

test('S1 route: only place and status are known actions', () => {
  const cfg = { demo_token: 'a', headers: { 'x-gs-token': 'a' } };
  assert.equal(run('check_token.js', { ...cfg, body: { action: 'place' } }).action, 'place');
  assert.equal(run('check_token.js', { ...cfg, body: { action: 'status' } }).action, 'status');
  assert.equal(run('check_token.js', { ...cfg, body: { action: 'drop table' } }).action, 'bad');
  assert.equal(run('check_token.js', { ...cfg }).action, 'bad');
});

test('S3 kill switch: SUB 11 and SUB 12 refuse writes with a clear message', () => {
  const r1 = run('guard_place.js', { kill_switch: true, session_id: 's', client_order_key: 'k', items: [{}], address: 'a' });
  assert.deepEqual([r1.ok, r1.status_code, r1.error], [false, 503, 'kill_switch']);
  assert.match(r1.message, /paused/);
  const r2 = run('guard_status.js', { kill_switch: true, session_id: 's', order_id: UUID, to_status: 'accepted', actor: 'kitchen' });
  assert.deepEqual([r2.ok, r2.status_code, r2.error], [false, 503, 'kill_switch']);
});

test('S1 place: a good order becomes an RPC body; bad input is refused with 400', () => {
  const good = { kill_switch: false, supabase_url: 'u', session_id: 's1', client_order_key: 'k1', items: [{ menu_item_id: UUID, qty: 2 }], address: 'Flat 4' };
  assert.deepEqual(run('guard_place.js', good).rpc_body, { p_session: 's1', p_key: 'k1', p_items: good.items, p_address: 'Flat 4' });
  for (const bad of [{ session_id: '' }, { client_order_key: ' ' }, { items: [] }, { items: 'x' }, { address: '' }, { items: new Array(21).fill({}) }, { session_id: 'x'.repeat(65) }]) {
    const r = run('guard_place.js', { ...good, ...bad });
    assert.deepEqual([r.ok, r.status_code, r.error], [false, 400, 'invalid_request'], JSON.stringify(bad).slice(0, 40));
  }
});

test('S2 status: a good change becomes an RPC body; bad input is refused with 400', () => {
  const good = { kill_switch: false, supabase_url: 'u', session_id: 's1', order_id: UUID, to_status: 'accepted', actor: 'kitchen' };
  assert.deepEqual(run('guard_status.js', good).rpc_body, { p_order: UUID, p_session: 's1', p_to: 'accepted', p_actor: 'kitchen' });
  for (const bad of [{ order_id: 'nope' }, { order_id: undefined }, { to_status: 5 }, { actor: 'hacker' }, { session_id: '' }]) {
    assert.equal(run('guard_status.js', { ...good, ...bad }).status_code, 400, JSON.stringify(bad));
  }
});

test('S1 S2 answers: database results map to codes and never leak raw text', () => {
  const order = { id: UUID, status: 'placed' };
  assert.deepEqual(run('shape.js', { statusCode: 200, body: { created: true, order } }), { ok: true, status_code: 201, order, created: true });
  assert.deepEqual(run('shape.js', { statusCode: 200, body: { created: false, order } }), { ok: true, status_code: 200, order, created: false });
  assert.equal(run('shape.js', { statusCode: 200, body: { order } }).status_code, 200);
  const err = (message, statusCode = 400) => run('shape.js', { statusCode, body: { code: 'P0001', message } });
  assert.deepEqual([err('order_not_found').status_code, err('order_not_found').error], [404, 'order_not_found']);
  assert.deepEqual([err('illegal status step: placed to ready').status_code, err('illegal status step: placed to ready').error], [409, 'illegal_step']);
  assert.equal(err('invalid_status: flying').status_code, 400);
  assert.deepEqual([err('invalid_item: unknown dish').status_code, err('invalid_item: unknown dish').error], [400, 'invalid_item']);
  assert.equal(err('invalid_address').error, 'invalid_address');
  const odd = run('shape.js', { statusCode: 500, body: { message: 'relation "orders" does not exist' } });
  assert.deepEqual([odd.ok, odd.status_code, odd.error], [false, 502, 'database_error']);
  assert.ok(!JSON.stringify(odd).includes('relation'));
  assert.equal(run('shape.js', { statusCode: 401, body: 'oops' }).status_code, 502);
  assert.deepEqual([err('session_order_cap').status_code, err('session_order_cap').error], [429, 'session_order_cap']);
  assert.equal(run('shape.js', { statusCode: 200, body: {} }).status_code, 502);   // wrong function or url: never a fake success
});

test('wiring: MAIN 01 calls SUB 11 and SUB 12 by id, with the fields their triggers declare', () => {
  for (const [key, callName, subName] of [['sub11', 'Call SUB 11 Place order', 'sub11'], ['sub12', 'Call SUB 12 Change status', 'sub12']]) {
    const call = byName(wf.main01, callName).parameters;
    assert.equal(call.workflowId.value, IDS[subName]);
    assert.equal(call.workflowId.mode, 'id');
    assert.equal(call.options.waitForSubWorkflow, true);
    const declared = byName(wf[key], 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
    assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
    assert.deepEqual(call.workflowInputs.schema.map((s) => s.id).sort(), declared);
  }
});

test('wiring: order after the trigger is Config, token check, kill switch, then the work', () => {
  const c = wf.main01.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual(next('Order webhook'), ['Config']);
  assert.deepEqual(next('Config'), ['Check token']);
  assert.deepEqual(next('Check token'), ['Token ok?']);
  assert.deepEqual([next('Token ok?', 0), next('Token ok?', 1)], [['Kill switch?'], ['Respond 401']]);
  assert.deepEqual([next('Kill switch?', 0), next('Kill switch?', 1)], [['Respond 503'], ['Route']]);
  assert.deepEqual([next('Route', 0), next('Route', 1), next('Route', 2), next('Route', 3), next('Route', 4), next('Route', 6)], [['Call SUB 11 Place order'], ['Call SUB 12 Change status'], ['Call SUB 13 Decide'], ['Call SUB 15 Add event'], ['Call SUB 16 Health'], ['Respond 400']]);
  assert.deepEqual(next('Call SUB 11 Place order'), ['Respond result']);
  assert.deepEqual(next('Call SUB 12 Change status'), ['Respond result']);
});

test('wiring: each SUB checks, then writes once, and a refusal never reaches the database', () => {
  for (const key of ['sub11', 'sub12']) {
    const c = wf[key].connections;
    assert.deepEqual(c.Start.main[0].map((x) => x.node), ['Guard']);
    assert.deepEqual(c.Guard.main[0].map((x) => x.node), ['Allowed?']);
    assert.equal(c['Allowed?'].main[1][0].node, 'Return refusal');
    assert.equal(Object.keys(c).includes('Return refusal'), false);
    const rpc = wf[key].nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest');
    assert.equal(c['Allowed?'].main[0][0].node, rpc.name);
    assert.equal(rpc.parameters.options.response.response.neverError, true);   // the answer is read in Shape result, not thrown
    assert.equal(rpc.continueOnFail, undefined);                                // B7: no continue on fail on a write path
  }
});

test('safety: write SUBs only accept calls from MAIN 01; no secret is written into the build', () => {
  for (const key of ['sub11', 'sub12']) {
    assert.equal(wf[key].settings.callerPolicy, 'workflowsFromAList');
    assert.equal(wf[key].settings.callerIds, IDS.main01);
  }
  assert.equal(byName(wf.main01, 'Config').parameters.assignments.assignments.find((a) => a.name === 'demo_token').value, PLACEHOLDER);
  const all = JSON.stringify(wf);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(all), 'a JWT is in the build');
  assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(all));
  assert.ok(!/tmxyizmkpwwfyazvrfhw|vpuumnslnionplrxmqlf/.test(all), 'a project ref is in the build; pass the url at deploy time');
  assert.equal(byName(wf.main01, 'Order webhook').parameters.httpMethod, 'POST');
});

test('workflow names follow the house prefix and numbers (B11 95.18)', () => {
  assert.deepEqual([wf.main01.name, wf.sub11.name, wf.sub12.name], ['GS MAIN 01 Order API', 'GS SUB 11 Place order', 'GS SUB 12 Change status']);
  assert.ok(wf.main01.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length <= 20);   // rulebook 95.1: aim for 15; split at about 25
});

for (const key of ['sub11', 'sub12', 'main01', 'alert']) {
  test(`canvas layout ${key}: boxes, gaps, text band, flow left to right (B12.5)`, () => {
    assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
  });
}

test('error alert: every order workflow reports to GS ERR 00; the alert itself has no chat id in the repo', () => {
  for (const key of ['sub11', 'sub12', 'main01']) assert.equal(wf[key].settings.errorWorkflow, 'ALERT1');
  assert.equal(wf.alert.settings.errorWorkflow, undefined);   // an alert that fails must not call itself
  assert.equal(wf.alert.name, 'GS ERR 00 Alert');
  assert.equal(byName(wf.alert, 'Config').parameters.assignments.assignments[0].value, PLACEHOLDER);
  assert.deepEqual(wf.alert.connections['Error trigger'].main[0].map((x) => x.node), ['Config']);
});

test('error alert: the message escapes HTML and carries workflow, node, error and execution', () => {
  const r = run('format_alert.js', { chat_id: '42', workflow: { name: 'GS MAIN 01 <x>' }, execution: { id: '7', lastNodeExecuted: 'Route', error: { message: 'a & b < c' } } });
  assert.equal(r.chat_id, '42');
  assert.match(r.text, /Workflow: GS MAIN 01 &lt;x&gt;/);
  assert.match(r.text, /Node: Route/);
  assert.match(r.text, /Error: a &amp; b &lt; c/);
  assert.match(r.text, /Execution: 7/);
  assert.doesNotThrow(() => run('format_alert.js', {}));
});

test('deploy: only the eleven GS workflows, alert first and MAIN last; the PUT body has only the allowed keys', () => {
  const { payload, NAMES, ORDER } = require('./deploy');
  assert.deepEqual(ORDER, ['alert', 'sub11', 'sub12', 'sub13', 'sub14', 'sub15', 'sub16', 'sub17', 'sub91', 'main01', 'main90']);
  assert.deepEqual(ORDER.map((k) => NAMES[k]), [wf.alert.name, wf.sub11.name, wf.sub12.name, wf.sub13.name, wf.sub14.name, wf.sub15.name, wf.sub16.name, wf.sub17.name, wf.sub91.name, wf.main01.name, wf.main90.name]);
  assert.deepEqual(Object.keys(payload(wf.main01)).sort(), ['connections', 'name', 'nodes', 'settings']);
  const src = fs.readFileSync(path.join(__dirname, 'deploy.js'), 'utf8');
  assert.ok(!/\/activate|'DELETE'/.test(src), 'deploy must never activate or delete');
});
