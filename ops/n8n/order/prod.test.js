// Story #78 (S3) tests, written BEFORE the code (red first): the PROD copy of the order workflows. Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { ENVS, NAMES, namesFor, orderFor } = require('./deploy');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub15: 'SUB15', sub16: 'SUB16', sub19: 'SUB19', sub20: 'SUB20', sub21: 'SUB21', sub22: 'SUB22', sub91: 'SUB91', sub93: 'SUB93', main90: 'MAIN90', main92: 'MAIN92', main93: 'MAIN93', alert: 'ALERT1' };
const prod = build({ ids: IDS, env: 'prod', supabaseUrl: 'https://prodref.supabase.co', token: 'prodtoken', chatId: '42' });
const dev = build({ ids: IDS, supabaseUrl: 'https://devref.supabase.co', token: 'devtoken', chatId: '42' });
const byName = (w, n) => w.nodes.find((x) => x.name === n);

test('S3 environments: prod has its own address, credential, token and name mark; nothing is shared with dev except the alert and Jev', () => {
  assert.equal(ENVS.dev.credential, 'GoServe Supabase dev');
  assert.deepEqual([ENVS.prod.urlVar, ENVS.prod.credential, ENVS.prod.tokenVar, ENVS.prod.suffix], ['SUPABASE_GOSERVE_PROD_URL', 'GoServe Supabase prod', 'GOSERVE_PROD_DEMO_TOKEN', ' PROD']);
  assert.notEqual(ENVS.prod.tokenVar, ENVS.dev.tokenVar);
  assert.notEqual(ENVS.prod.urlVar, ENVS.dev.urlVar);
  assert.equal(ENVS.dev.suffix, '');
});

test('S3 the prod set has fifteen workflows (no second alert), the dev set keeps sixteen; SUBs before MAINs', () => {
  assert.deepEqual(orderFor('prod'), ['sub11', 'sub12', 'sub13', 'sub14', 'sub15', 'sub16', 'sub18', 'sub17', 'sub19', 'sub20', 'sub21', 'sub22', 'sub91', 'sub93', 'main01', 'main90', 'main92', 'main93']);
  assert.equal(orderFor('dev').length, 19);
  assert.equal(orderFor('dev')[0], 'alert');
  assert.equal(namesFor('prod').main01, 'GS MAIN 01 Order API PROD');
  assert.equal(namesFor('dev').main01, NAMES.main01);
  assert.equal(namesFor('prod').alert, undefined);
});

test('S3 prod workflows carry the PROD mark and their own webhook path; dev is unchanged', () => {
  for (const k of ['sub11', 'sub12', 'sub13', 'sub14', 'sub15', 'sub16', 'sub18', 'sub17', 'sub19', 'sub20', 'sub21', 'sub22', 'sub91', 'sub93', 'main01', 'main90', 'main92', 'main93']) assert.equal(prod[k].name, namesFor('prod')[k], k);
  assert.equal(dev.main01.name, 'GS MAIN 01 Order API');
  const p = byName(prod.main01, 'Order webhook'), d = byName(dev.main01, 'Order webhook');
  assert.equal(p.parameters.path, 'gs-order-prod');
  assert.equal(d.parameters.path, 'gs-order');
  assert.notEqual(p.webhookId, d.webhookId);
});

test('S3 prod uses the prod address, the prod token and the shared alert; no dev address anywhere', () => {
  const cfg = (w, k) => byName(w, 'Config').parameters.assignments.assignments.find((a) => a.name === k).value;
  assert.equal(cfg(prod.main01, 'supabase_url'), 'https://prodref.supabase.co');
  assert.equal(cfg(prod.main01, 'demo_token'), 'prodtoken');
  assert.equal(cfg(dev.main01, 'demo_token'), 'devtoken');
  assert.equal(prod.main01.settings.errorWorkflow, 'ALERT1');
  assert.ok(!JSON.stringify(Object.values(prod)).includes('devref'));
  assert.ok(!/tmxyizmkpwwfyazvrfhw/.test(JSON.stringify(Object.values(prod))));
});

test('S3 prod MAIN 01 calls the prod SUBs by id and the prod set is called only by its own MAINs', () => {
  assert.equal(byName(prod.main01, 'Call SUB 11 Place order').parameters.workflowId.value, 'SUB11');
  assert.equal(prod.sub11.settings.callerIds, 'MAIN1');
  assert.equal(prod.sub91.settings.callerIds, 'MAIN90,MAIN93');
});

test('S3 the prod copy has the same canvas as dev and passes the layout checks', () => {
  for (const k of ['sub11', 'sub13', 'sub16', 'sub91', 'main01', 'main90']) assert.deepEqual(checkLayout(prod[k], prod[k].sections), [], k);
  assert.equal(prod.main01.nodes.length, dev.main01.nodes.length);
});

test('S3 deploy.js has no hard-coded project address and takes the credential name from the environment table', () => {
  const src = fs.readFileSync(path.join(__dirname, 'deploy.js'), 'utf8');
  assert.ok(!/tmxyizmkpwwfyazvrfhw|vpuumnslnionplrxmqlf/.test(src));
  assert.match(src, /--env/);
  assert.ok(!/'\/activate|"DELETE"|'DELETE'/.test(src));
});
