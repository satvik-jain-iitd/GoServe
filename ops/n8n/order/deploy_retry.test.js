// Story (deploy retry, reviewer's ask 29 Oct 2026): the prod deploy stopped after SUB 14 with "Unexpected token '<', "<!DOCTYPE "... is not valid JSON": the shared box answered a Cloudflare 520 HTML page.
// A non-JSON answer is retried (3 tries, 30 s apart); a JSON answer, good or a refusal, is never retried; --from resumes at one workflow.
// Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCall, resumeFrom } = require('./deploy');

const html = () => ({ ok: false, status: 520, json: async () => { throw new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON'); } });
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const refuse = () => ({ ok: false, status: 401, json: async () => ({ message: 'unauthorized' }) });
const fake = (answers) => { const calls = []; const fn = async (url) => { calls.push(url); const a = answers.shift(); if (a instanceof Error) throw a; return a; }; fn.calls = calls; return fn; };

test('R1 an HTML answer is tried again after a wait, and the good answer is returned', async () => {
  const f = fake([html(), html(), ok({ data: [1] })]); const waits = [];
  const call = makeCall(f, 'key', { sleep: async (ms) => waits.push(ms) });
  assert.deepEqual(await call('GET', '/workflows'), { data: [1] });
  assert.equal(f.calls.length, 3);
  assert.deepEqual(waits, [30000, 30000]);
});

test('R2 three HTML answers in a row stop with a plain error that names the call', async () => {
  const f = fake([html(), html(), html()]);
  const call = makeCall(f, 'key', { sleep: async () => {} });
  await assert.rejects(call('PUT', '/workflows/abc', {}), /PUT \/workflows\/abc.*not JSON.*3 tries/);
  assert.equal(f.calls.length, 3);
});

test('R3 a JSON refusal is a real answer: no retry, the error as before', async () => {
  const f = fake([refuse()]);
  const call = makeCall(f, 'key', { sleep: async () => { throw new Error('must not wait'); } });
  await assert.rejects(call('GET', '/workflows'), /GET \/workflows -> 401.*unauthorized/);
  assert.equal(f.calls.length, 1);
});

test('R4 a dropped connection is tried again like an HTML answer', async () => {
  const f = fake([new TypeError('fetch failed'), ok({ ok: true })]);
  const call = makeCall(f, 'key', { sleep: async () => {} });
  assert.deepEqual(await call('GET', '/workflows'), { ok: true });
});

test('R5 --from skips the workflows before it and refuses a name that is not in the list', () => {
  assert.deepEqual(resumeFrom(['alert', 'sub11', 'sub12', 'sub13'], 'sub12'), ['sub12', 'sub13']);
  assert.deepEqual(resumeFrom(['alert', 'sub11'], undefined), ['alert', 'sub11']);
  assert.throws(() => resumeFrom(['alert', 'sub11'], 'sub99'), /--from sub99/);
});
