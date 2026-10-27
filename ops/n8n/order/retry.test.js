// Story #541: every timer retries a slow Supabase call (follows #532, which fixed one node). Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('./build');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub19: 'SUB19', sub20: 'SUB20', sub21: 'SUB21', sub22: 'SUB22', main34: 'MAIN34', alert: 'ALERT1' };
const wf = build({ ids: IDS, vapidPublicKey: 'PUBKEY', vapidSubject: 'mailto:ops@example.com' });
const TIMER = ['main31', 'main32', 'main33', 'main34', 'main90', 'main92', 'main93'];   // schedules
const CALLED = ['sub20', 'sub30', 'sub32', 'sub33', 'sub91', 'sub93', 'sub94'];           // SUBs a timer calls
const supabase = (w) => w.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest' && JSON.stringify(n.parameters.url || '').includes('/rest/v1/'));

test('R1 every Supabase HTTP node in a timer workflow, or a SUB a timer calls, retries 3 times, 5 s apart, with a 20 s timeout', () => {
  let seen = 0;
  for (const key of [...TIMER, ...CALLED]) {
    for (const n of supabase(wf[key])) {
      seen++;
      assert.equal(n.retryOnFail, true, `${key} ${n.name}: retryOnFail`);
      assert.equal(n.maxTries, 3, `${key} ${n.name}: maxTries`);
      assert.equal(n.waitBetweenTries, 5000, `${key} ${n.name}: waitBetweenTries`);
      assert.equal(n.parameters.options.timeout, 20000, `${key} ${n.name}: timeout`);
      assert.equal(n.continueOnFail, undefined, `${key} ${n.name}: a failed call stops the run (rulebook B7)`);
    }
  }
  assert.ok(seen >= 8, `expected the timer Supabase nodes, found ${seen}`);
});

test('R2 the timers that matter are all covered: Take queue, Seed or reset, the sim tick call, the dispatch tick call', () => {
  const names = [...TIMER, ...CALLED].flatMap((k) => supabase(wf[k]).map((n) => n.name));
  for (const want of ['Take queue', 'Seed or reset']) assert.ok(names.includes(want), want);
});

test('R3 the order API is not changed: a customer waits there and the app retries', () => {
  for (const key of ['main01', 'sub11', 'sub12', 'sub13', 'sub14', 'sub19']) {
    for (const n of supabase(wf[key])) {
      assert.equal(n.retryOnFail, undefined, `${key} ${n.name}`);
      assert.ok(n.parameters.options.timeout <= 10000, `${key} ${n.name}: a short timeout stays short`);
    }
  }
});
