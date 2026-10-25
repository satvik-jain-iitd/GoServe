// Story #263 layer 2: Stage 1 batch dispatch. GS MAIN 33 ticks every 30 s and calls GS SUB 33, which runs dispatch_tick(). SUB 22 stands down in batch mode.
// Run: node --test ops/n8n/order/dispatch_batch.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub21: 'SUB21', sub22: 'SUB22', sub33: 'SUB33', main33: 'MAIN33', alert: 'ALERT1' };
const wf = build({ ids: IDS });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, input) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, () => { throw new Error('no named node here'); })[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);

test('#263 L2 the rider read passes the batch flag only when it is true; the zone_closed refusal has a plain 409', () => {
  assert.deepEqual(run('shape.js', { statusCode: 200, body: { riders: [{ id: 'r1' }], batch: true } }), { ok: true, status_code: 200, riders: [{ id: 'r1' }], batch: true });
  assert.deepEqual(run('shape.js', { statusCode: 200, body: { riders: [{ id: 'r1' }] } }), { ok: true, status_code: 200, riders: [{ id: 'r1' }] });
  const z = run('shape.js', { statusCode: 400, body: { message: 'zone_closed' } });
  assert.deepEqual([z.status_code, z.error], [409, 'zone_closed']);
  assert.match(z.message, /busy/i);
});

test('#263 L2 SUB 22 stands down in batch mode: after the rider read, a batch flag ends the run without an error', () => {
  const s = wf.sub22;
  assert.deepEqual(next(s, 'Call SUB 21 Riders'), ['Batch mode?']);
  assert.deepEqual([next(s, 'Batch mode?', 0), next(s, 'Batch mode?', 1)], [['Batch dispatch'], ['Riders found?']]);
  assert.equal(byName(s, 'Batch dispatch').type, 'n8n-nodes-base.noOp');
  assert.deepEqual([next(s, 'Riders found?', 0), next(s, 'Riders found?', 1)], [['Prepare decision'], ['No rider']]);   // the old path is unchanged
  assert.match(byName(s, 'Batch mode?').parameters.conditions.conditions[0].leftValue, /batch/);
});

test('#263 L2 the tick guard: kill switch first, then one database function with no input', () => {
  const g = (over) => run('guard_dispatch.js', { kill_switch: false, supabase_url: 'u', ...over });
  assert.equal(g({ kill_switch: true }).status_code, 503);
  const ok = g({});
  assert.deepEqual([ok.ok, ok.supabase_url, ok.rpc_body], [true, 'u', {}]);
  assert.equal(run('dispatch_tick.js', { kill_switch: false, supabase_url: 'u', env: 'dev' }).kill_switch, false);
});

test('#263 L2 MAIN 33 wiring: a 30 second clock, Config, kill switch, Tick, SUB 33; no successful run is kept', () => {
  const m = wf.main33;
  const t = byName(m, 'Every 30 seconds');
  assert.equal(t.type, 'n8n-nodes-base.scheduleTrigger');
  assert.equal(t.parameters.rule.interval[0].expression, '*/30 * * * * *');
  assert.deepEqual(next(m, 'Every 30 seconds'), ['Config']);
  assert.deepEqual(next(m, 'Config'), ['Kill switch?']);
  assert.deepEqual([next(m, 'Kill switch?', 0), next(m, 'Kill switch?', 1)], [['Paused'], ['Tick']]);
  assert.deepEqual(next(m, 'Tick'), ['Call SUB 33 Dispatch']);
  assert.equal(byName(m, 'Call SUB 33 Dispatch').parameters.workflowId.value, 'SUB33');
  assert.equal(m.settings.saveDataSuccessExecution, 'none');   // 2880 runs a day would bury real errors
  assert.equal(m.settings.errorWorkflow, 'ALERT1');
});

test('#263 L2 SUB 33: only MAIN 33 may call it; one write to dispatch_tick with the stored credential', () => {
  const s = wf.sub33;
  assert.deepEqual([s.settings.callerPolicy, s.settings.callerIds], ['workflowsFromAList', 'MAIN33']);
  const http = byName(s, 'Dispatch tick');
  assert.equal(http.parameters.url, '={{ $json.supabase_url }}/rest/v1/rpc/dispatch_tick');
  assert.ok(http.credentials && http.credentials.httpCustomAuth);
  assert.deepEqual([next(s, 'Allowed?', 0), next(s, 'Allowed?', 1)], [['Dispatch tick'], ['Return refusal']]);
});

for (const key of ['sub22', 'sub33', 'main33']) {
  test(`#263 L2 canvas layout ${key}`, () => assert.deepEqual(checkLayout(wf[key], wf[key].sections), []));
}
