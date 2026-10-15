// Story S-B (#94) tests, written BEFORE the code (red first). Run: node --test "ops/n8n/order/*.test.js"
// GS SUB 17 Feedback: Guard -> save the report (fails closed) -> Drive file -> link -> Telegram -> answer. MAIN 01 routes the action `feedback`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, PLACEHOLDER } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub14: 'SUB14', sub15: 'SUB15', sub16: 'SUB16', sub17: 'SUB17', sub91: 'SUB91', main90: 'MAIN90', alert: 'ALERT1' };
const wf = build({ ids: IDS, driveFolderId: 'FOLDER1', chatId: '42', envName: 'dev' });
const UUID = '11111111-1111-1111-1111-111111111111';
const ORDER = '22222222-2222-2222-2222-222222222222';
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const run = (file, json, others = {}, self = {}) => new Function('$input', '$', src(file)).call(self, { first: () => ({ json }) }, (n) => ({ first: () => ({ json: others[n] }), isExecuted: n in others }))[0].json;
const runAsync = async (file, json, self) => (await new AsyncFn('$input', '$', src(file)).call(self, { first: () => ({ json }) }, () => ({ first: () => ({ json: {} }) })))[0];
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => ((w.connections[n] || { main: [] }).main[i] || []).map((x) => x.node);

const good = { kill_switch: false, supabase_url: 'u', session_id: 's1', kitchen_id: UUID, role: 'kitchen', screen: '/kitchen/', order_id: ORDER, doing: 'cooking',
  text: 'Accept button did nothing', context: { trail: [] }, image_b64: 'QUJD', drive_folder_id: 'FOLDER1', chat_id: '42', env: 'dev' };
const guard = (over) => run('guard_feedback.js', { ...good, ...over });

test('S1 Guard: a good report becomes a feedback row; the picture and the Drive folder are kept for later', () => {
  const r = guard({});
  assert.equal(r.ok, true);
  assert.deepEqual(r.row, { kitchen_id: UUID, session_id: 's1', role: 'kitchen', screen: '/kitchen/', order_id: ORDER, doing: 'cooking', text: 'Accept button did nothing', context: { trail: [] } });
  assert.deepEqual([r.has_image, r.drive_ready, r.image_b64, r.drive_folder_id, r.chat_id, r.env], [true, true, 'QUJD', 'FOLDER1', '42', 'dev']);
});

test('S2 Guard: no picture and no order are fine; an unset Drive folder turns the Drive step off', () => {
  const r = guard({ image_b64: undefined, order_id: '' });
  assert.deepEqual([r.ok, r.has_image, r.row.order_id], [true, false, null]);
  assert.equal(guard({ drive_folder_id: PLACEHOLDER }).drive_ready, false);
});

test('Guard: the kill switch, bad input and big pictures are refused with a code', () => {
  assert.deepEqual([guard({ kill_switch: true }).status_code, guard({ kill_switch: true }).error], [503, 'kill_switch']);
  for (const bad of [{ text: '   ' }, { text: 'x'.repeat(2001) }, { doing: 'flying' }, { role: 'admin' }, { session_id: '' }, { kitchen_id: 'x' }, { order_id: 'nope' }, { context: 'str' },
    { image_b64: 'x'.repeat(2_000_001) }, { image_b64: 'not base64!' }, { screen: 'x'.repeat(201) }]) {
    const r = guard(bad);
    assert.deepEqual([r.ok, r.status_code, r.error], [false, 400, 'invalid_request'], JSON.stringify(bad).slice(0, 40));
  }
});

test('S5 Check saved: only a stored row goes on; any database refusal is 502 and never leaks raw text', () => {
  const g = { ...guard({}), ok: true };
  const ok = run('feedback_saved.js', { statusCode: 201, body: [{ id: 'f1' }] }, { Guard: g });
  assert.deepEqual([ok.ok, ok.status_code, ok.id], [true, 201, 'f1']);
  assert.equal(ok.has_image, true);
  for (const res of [{ statusCode: 400, body: { message: 'relation "feedback" does not exist' } }, { statusCode: 201, body: [] }, { statusCode: 401, body: 'x' }]) {
    const r = run('feedback_saved.js', res, { Guard: g });
    assert.deepEqual([r.ok, r.status_code, r.error], [false, 502, 'database_error']);
    assert.ok(!JSON.stringify(r).includes('relation'));
  }
});

test('Make file: the picture becomes a JPEG named date, role and the first 8 characters of the id', async () => {
  const seen = {};
  const self = { helpers: { prepareBinaryData: async (buf, name, mime) => { Object.assign(seen, { len: buf.length, name, mime }); return { fileName: name, mimeType: mime }; } } };
  const out = await runAsync('feedback_file.js', { ...guard({}), id: 'abcdef12-0000-4000-8000-000000000000' }, self);
  assert.match(seen.name, /^\d{8}_kitchen_abcdef12\.jpg$/);
  assert.deepEqual([seen.mime, seen.len], ['image/jpeg', 3]);
  assert.equal(out.json.file_name, seen.name);
  assert.ok(out.binary.data);
});

test('Build message: first lines, the kind of work, the order, and the Drive link or why there is none', () => {
  const g = { ...guard({}), id: 'f1', ok: true };
  const withLink = run('feedback_message.js', {}, { 'Check saved': g, 'Upload to Drive': { id: 'DRIVE9' } });
  assert.match(withLink.text, /New feedback \(dev\) from kitchen/);
  assert.match(withLink.text, /Accept button did nothing/);
  assert.match(withLink.text, /cooking/);
  assert.match(withLink.text, /https:\/\/drive\.google\.com\/file\/d\/DRIVE9\/view/);
  assert.equal(withLink.chat_id, '42');
  const none = run('feedback_message.js', {}, { 'Check saved': { ...g, has_image: false } });
  assert.match(none.text, /no picture/);
  const failed = run('feedback_message.js', {}, { 'Check saved': g, 'Upload to Drive': { error: { message: 'x' } } });
  assert.match(failed.text, /picture not saved/i);
  const off = run('feedback_message.js', {}, { 'Check saved': { ...g, drive_ready: false } });
  assert.match(off.text, /picture not saved/i);
});

test('Answer: 201 with the new id', () => {
  const r = run('feedback_answer.js', {}, { 'Check saved': { id: 'f1' } });
  assert.deepEqual(r, { ok: true, status_code: 201, id: 'f1' });
});

test('wiring SUB 17: guard, then one write that fails closed, then the picture, then Telegram, then the answer', () => {
  const w = wf.sub17;
  assert.equal(w.name, 'GS SUB 17 Feedback');
  assert.deepEqual(next(w, 'Start'), ['Guard']);
  assert.deepEqual(next(w, 'Guard'), ['Allowed?']);
  assert.deepEqual([next(w, 'Allowed?', 0), next(w, 'Allowed?', 1)], [['Save report'], ['Return refusal']]);
  assert.deepEqual(next(w, 'Save report'), ['Check saved']);
  assert.deepEqual(next(w, 'Check saved'), ['Saved?']);
  assert.deepEqual([next(w, 'Saved?', 0), next(w, 'Saved?', 1)], [['Has picture?'], ['Return refusal']]);
  assert.deepEqual([next(w, 'Has picture?', 0), next(w, 'Has picture?', 1)], [['Make file'], ['Build message']]);
  assert.deepEqual(next(w, 'Make file'), ['Upload to Drive']);
  assert.deepEqual(next(w, 'Upload to Drive'), ['Link file']);
  assert.deepEqual(next(w, 'Link file'), ['Build message']);
  assert.deepEqual(next(w, 'Build message'), ['Notify owner']);
  assert.deepEqual(next(w, 'Notify owner'), ['Answer']);
  const save = byName(w, 'Save report');
  assert.equal(save.onError, undefined);                                        // B7: the write path fails closed
  assert.equal(save.parameters.options.response.response.neverError, true);    // read in Check saved, so a refusal becomes 502
  assert.match(save.parameters.url, /\/rest\/v1\/feedback$/);
  for (const side of ['Upload to Drive', 'Link file', 'Notify owner']) assert.equal(byName(w, side).onError, 'continueRegularOutput', side);   // a side effect never undoes the saved report
});

test('wiring SUB 17: Drive and Telegram use the named credentials; the file goes into the folder from Config', () => {
  const w = wf.sub17;
  const drive = byName(w, 'Upload to Drive');
  assert.equal(drive.type, 'n8n-nodes-base.googleDrive');
  assert.deepEqual([drive.parameters.resource, drive.parameters.operation], ['file', 'upload']);
  assert.equal(drive.credentials.googleDriveOAuth2Api.name, 'Klickbae8yt@gmail.com');
  assert.match(drive.parameters.folderId.value, /drive_folder_id/);
  assert.equal(byName(w, 'Notify owner').credentials.telegramApi.name, 'GoServeBot');
  assert.equal(byName(w, 'Save report').credentials.httpCustomAuth.name, 'GoServe Supabase dev');
  assert.equal(w.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(w.settings.callerIds, IDS.main01);
});

test('wiring MAIN 01: the route `feedback` calls SUB 17 with the fields its trigger declares, and the answer carries the id', () => {
  const route = byName(wf.main01, 'Route');
  assert.ok(route.parameters.rules.values.some((v) => v.outputKey === 'feedback'));
  const idx = route.parameters.rules.values.findIndex((v) => v.outputKey === 'feedback');
  assert.deepEqual(next(wf.main01, 'Route', idx), ['Call SUB 17 Feedback']);
  assert.deepEqual(next(wf.main01, 'Call SUB 17 Feedback'), ['Respond result']);
  const call = byName(wf.main01, 'Call SUB 17 Feedback').parameters;
  assert.equal(call.workflowId.value, IDS.sub17);
  const declared = byName(wf.sub17, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
  assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
  const cfg = byName(wf.main01, 'Config').parameters.assignments.assignments;
  assert.equal(cfg.find((a) => a.name === 'drive_folder_id').value, 'FOLDER1');
  assert.equal(cfg.find((a) => a.name === 'chat_id').value, '42');
  assert.equal(cfg.find((a) => a.name === 'env').value, 'dev');
  assert.match(byName(wf.main01, 'Respond result').parameters.responseBody, /id: \$json\.id/);
});

test('prod copy: its own folder, `prod` in the message, PROD in the name, nothing from dev', () => {
  const prod = build({ ids: IDS, env: 'prod', driveFolderId: 'FOLDERP', envName: 'prod', chatId: '42' });
  assert.equal(prod.sub17.name, 'GS SUB 17 Feedback PROD');
  const cfg = byName(prod.main01, 'Config').parameters.assignments.assignments;
  assert.deepEqual([cfg.find((a) => a.name === 'drive_folder_id').value, cfg.find((a) => a.name === 'env').value], ['FOLDERP', 'prod']);
});

test('safety and layout: no secret in the build, the canvas rules hold', () => {
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(JSON.stringify(wf.sub17)));
  for (const key of ['sub17', 'main01']) assert.deepEqual(checkLayout(wf[key], wf[key].sections), []);
});
