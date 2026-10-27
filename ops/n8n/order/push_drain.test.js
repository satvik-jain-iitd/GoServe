// Story #483: one way to send a push. The database queues a push for every order step (any path); GS MAIN 34 takes the queue every 30 s and calls SUB 20.
// Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub19: 'SUB19', sub20: 'SUB20', sub21: 'SUB21', sub22: 'SUB22', main34: 'MAIN34', alert: 'ALERT1' };
const wf = build({ ids: IDS, vapidPublicKey: 'PUBKEY', vapidSubject: 'mailto:ops@example.com' });
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, from, out = 0) => (w.connections[from]?.main[out] || []).map((x) => x.node);
const runCode = (file, input, nodes) => new Function('$input', '$', fs.readFileSync(path.join(__dirname, 'code', file), 'utf8'))(
  { first: () => ({ json: input }), all: () => [{ json: input }] }, (n) => ({ first: () => ({ json: nodes[n] }) })).map((x) => x.json);

test('D1 MAIN 34 wiring: a 30 second clock, Config, kill switch, Tick, take the queue, one item per row, SUB 20 once for each', () => {
  const m = wf.main34;
  assert.equal(byName(m, 'Every 30 seconds').parameters.rule.interval[0].expression, '*/30 * * * * *');
  assert.deepEqual(next(m, 'Every 30 seconds'), ['Config']);
  assert.deepEqual(next(m, 'Config'), ['Kill switch?']);
  assert.deepEqual([next(m, 'Kill switch?', 0), next(m, 'Kill switch?', 1)], [['Paused'], ['Tick']]);
  assert.deepEqual(next(m, 'Tick'), ['Take queue']);
  assert.deepEqual(next(m, 'Take queue'), ['Expand rows']);
  assert.deepEqual(next(m, 'Expand rows'), ['Call SUB 20 Push']);
  assert.equal(byName(m, 'Call SUB 20 Push').parameters.workflowId.value, 'SUB20');
  assert.equal(byName(m, 'Call SUB 20 Push').parameters.mode, 'each');   // one run of SUB 20 for every queued push
  assert.equal(m.settings.saveDataSuccessExecution, 'none');            // 2880 runs a day would bury real errors
  assert.equal(m.settings.errorWorkflow, 'ALERT1');
});

test('D2 Take queue is one write to push_outbox_take with the stored credential', () => {
  const http = byName(wf.main34, 'Take queue');
  assert.equal(http.parameters.url, '={{ $json.supabase_url }}/rest/v1/rpc/push_outbox_take');
  assert.ok(http.credentials && http.credentials.httpCustomAuth);
});

test('D3 expand rows: one item per queued push with the VAPID settings; an empty queue gives no item', () => {
  const cfg = { supabase_url: 'u', kill_switch: false, vapid_public_key: 'PUB', vapid_subject: 'mailto:a@b.c' };
  const rows = [{ id: 1, order_id: 'o1', session_id: 's1', status: 'ready' }, { id: 2, order_id: 'o2', session_id: 's2', status: 'delivered' }];
  const out = runCode('push_drain_expand.js', { statusCode: 200, body: { rows } }, { Tick: cfg });
  assert.deepEqual(out.map((x) => [x.order_id, x.session_id, x.status]), [['o1', 's1', 'ready'], ['o2', 's2', 'delivered']]);
  assert.deepEqual([out[0].vapid_public_key, out[0].vapid_subject, out[0].supabase_url, out[0].kill_switch], ['PUB', 'mailto:a@b.c', 'u', false]);
  assert.deepEqual(runCode('push_drain_expand.js', { statusCode: 200, body: { rows: [] } }, { Tick: cfg }), []);
  assert.deepEqual(runCode('push_drain_expand.js', { statusCode: 500, body: {} }, { Tick: cfg }), []);   // a database error sends nothing; the run log shows the 500
});

test('D4 one way: MAIN 01 no longer calls SUB 20; only MAIN 34 may', () => {
  assert.equal(byName(wf.main01, 'Push?'), undefined);
  assert.equal(byName(wf.main01, 'Call SUB 20 Push'), undefined);
  assert.deepEqual([wf.sub20.settings.callerPolicy, wf.sub20.settings.callerIds], ['workflowsFromAList', 'MAIN34']);
});

test('D5 canvas layout and deploy order', () => {
  assert.deepEqual(checkLayout(wf.main34, wf.main34.sections), []);
  assert.deepEqual(checkLayout(wf.main01, wf.main01.sections), []);
  const { ORDER, NAMES } = require('./deploy');
  assert.ok(ORDER.indexOf('main34') > ORDER.indexOf('sub20'));
  assert.equal(NAMES.main34, wf.main34.name);
});

test('D6 (#532) Take queue retries a slow call: 3 tries, 5 s apart, 20 s timeout, and no other MAIN 34 node changes', () => {
  const take = byName(wf.main34, 'Take queue');
  assert.equal(take.retryOnFail, true);
  assert.equal(take.maxTries, 3);
  assert.equal(take.waitBetweenTries, 5000);
  assert.equal(take.parameters.options.timeout, 20000);
  assert.equal(take.continueOnFail, undefined);   // rulebook B7: a failed take stops the run, it never carries on
  const others = wf.main34.nodes.filter((n) => n.name !== 'Take queue' && n.type === 'n8n-nodes-base.httpRequest');
  assert.deepEqual(others, []);   // Take queue is the only HTTP node in MAIN 34
});
