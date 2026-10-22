// Story #50 tests, written BEFORE the code (red first): SUB 15 Add event, the rider's "arriving" tap. Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub15: 'SUB15', alert: 'ALERT1' };
const wf = build({ ids: IDS });
const UUID = '11111111-1111-1111-1111-111111111111';
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, json) => new Function('$input', '$', src(file))({ first: () => ({ json }) }, () => ({ first: () => ({ json: {} }) }))[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const good = { kill_switch: false, supabase_url: 'u', session_id: 's1', order_id: UUID, event: 'order.arriving', actor: 'rider' };

test('S1 SUB 15: arriving by the rider becomes a database call', () => {
  assert.deepEqual(run('guard_event.js', good).rpc_body, { p_order: UUID, p_session: 's1', p_event: 'order.arriving', p_actor: 'rider' });
});

test('S1 SUB 15: kill switch gives 503; bad input and other events give 400', () => {
  const k = run('guard_event.js', { ...good, kill_switch: true });
  assert.deepEqual([k.ok, k.status_code, k.error], [false, 503, 'kill_switch']);
  for (const bad of [{ order_id: 'nope' }, { session_id: '' }, { actor: 'hacker' }, { event: 'order.delivered' }, { event: undefined }]) {
    assert.equal(run('guard_event.js', { ...good, ...bad }).status_code, 400, JSON.stringify(bad));
  }
});

test('S1 answers: a wrong state or a repeat gives 409, an unknown event 400, never raw text', () => {
  const err = (message) => run('shape.js', { statusCode: 400, body: { code: 'P0001', message } });
  assert.deepEqual([err('illegal_event: order.arriving while placed').status_code, err('illegal_event: x').error], [409, 'illegal_step']);
  assert.deepEqual([err('event_exists').status_code, err('event_exists').error, err('event_exists').message], [409, 'already_done', 'Already done.']);
  assert.deepEqual([err('invalid_event: order.delivered').status_code, err('invalid_event: x').error, err('invalid_event: x').message], [400, 'invalid_event', 'Unknown event.']);
  assert.equal(err('invalid_status: flying').message, 'Unknown status.');
});

test('check token: event is a known action', () => {
  const r = run('check_token.js', { demo_token: 'a', headers: { 'x-gs-token': 'a' }, body: { action: 'event' } });
  assert.equal(r.action, 'event');
});

test('wiring: MAIN 01 routes event to SUB 15 and answers through Respond result', () => {
  const c = wf.main01.connections;
  const next = (n, i = 0) => c[n].main[i].map((x) => x.node);
  assert.deepEqual([next('Route', 3), next('Route', 7)], [['Call SUB 15 Add event'], ['Respond 400']]);
  assert.deepEqual(next('Call SUB 15 Add event'), ['Respond result']);
  const call = byName(wf.main01, 'Call SUB 15 Add event').parameters;
  assert.equal(call.workflowId.value, 'SUB15');
  const declared = byName(wf.sub15, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
  assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
});

test('wiring: SUB 15 checks, writes once through the database function, and is locked to MAIN 01', () => {
  const c = wf.sub15.connections;
  assert.equal(wf.sub15.name, 'GS SUB 15 Add event');
  assert.deepEqual(c.Guard.main[0].map((x) => x.node), ['Allowed?']);
  assert.equal(c['Allowed?'].main[1][0].node, 'Return refusal');
  const rpc = byName(wf.sub15, 'Add event');
  assert.match(rpc.parameters.url, /rpc\/rider_event$/);
  assert.equal(rpc.continueOnFail, undefined);
  assert.equal(wf.sub15.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(wf.sub15.settings.callerIds, 'MAIN1');
  assert.equal(wf.sub15.settings.errorWorkflow, 'ALERT1');
});

test('the receive box of MAIN 01 names all four actions', () => {
  const note = wf.main01.nodes.find((n) => n.parameters && n.parameters.content && n.parameters.content.startsWith('## RECEIVE')).parameters.content;
  for (const a of ['place', 'status', 'decide', 'event']) assert.match(note, new RegExp(a));
});

test('canvas layout of SUB 15 and MAIN 01 with the event route', () => {
  for (const key of ['sub15', 'main01']) assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
});
