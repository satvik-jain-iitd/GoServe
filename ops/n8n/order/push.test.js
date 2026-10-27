// Story A7 (#154): SUB 20 Push sends a text-less web push for a placed, ready or delivered order. Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', main34: 'MAIN34', sub11: 'SUB11', sub12: 'SUB12', sub13: 'SUB13', sub19: 'SUB19', sub20: 'SUB20', sub21: 'SUB21', sub22: 'SUB22', alert: 'ALERT1' };
const wf = build({ ids: IDS, vapidPublicKey: 'PUBKEY', vapidSubject: 'mailto:ops@example.com' });
const src = (file) => fs.readFileSync(path.join(__dirname, 'code', file), 'utf8');
const run = (file, json, nodes = {}) => new Function('$input', '$', 'Date', src(file))({ first: () => ({ json }), all: () => (Array.isArray(json) ? json.map((j) => ({ json: j })) : [{ json }]) },
  (name) => ({ first: () => ({ json: nodes[name] }), all: () => [{ json: nodes[name] }] }), Date)[0].json;
const runAll = (file, items, nodes = {}) => new Function('$input', '$', 'Date', src(file))({ first: () => ({ json: items[0] }), all: () => items.map((json) => ({ json })) },
  (name) => ({ first: () => ({ json: [].concat(nodes[name])[0] }), all: () => [].concat(nodes[name]).map((json) => ({ json })) }), Date).map((x) => x.json);
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, from, out = 0) => (w.connections[from]?.main[out] || []).map((x) => x.node);
const SESSION = '7e57ab1e-0000-4000-8000-0000000000a1';

test('S1 guard: only placed, ready and delivered are pushed; the kill switch and a bad session are refused', () => {
  const good = { kill_switch: false, supabase_url: 'u', session_id: SESSION, status: 'ready', vapid_public_key: 'PUB', vapid_subject: 'mailto:a@b.c' };
  assert.deepEqual(run('guard_push.js', good).rpc_body, { p_session: SESSION });
  for (const status of ['placed', 'ready', 'delivered']) assert.equal(run('guard_push.js', { ...good, status }).ok, true, status);
  for (const status of ['accepted', 'preparing', 'out_for_delivery', 'cancelled', 'nonsense', undefined]) {
    const r = run('guard_push.js', { ...good, status });
    assert.deepEqual([r.ok, r.status_code, r.error], [false, 200, 'not_pushed'], String(status));   // not an error: nothing to send
  }
  assert.equal(run('guard_push.js', { ...good, kill_switch: true }).status_code, 503);
  assert.equal(run('guard_push.js', { ...good, session_id: '' }).status_code, 400);
  assert.equal(run('guard_push.js', { ...good, vapid_public_key: '' }).status_code, 400);   // a build without a key must not pretend to push
});

test('S2 expand: one item per subscription with the VAPID claims for the push service of that endpoint', () => {
  const state = { vapid_public_key: 'PUB', vapid_subject: 'mailto:a@b.c', supabase_url: 'u' };
  const out = runAll('push_expand.js', [{ statusCode: 200, body: { targets: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }, { endpoint: 'https://web.push.apple.com/XYZ' }] } }], { Guard: state });
  assert.equal(out.length, 2);
  assert.equal(out[0].endpoint, 'https://fcm.googleapis.com/fcm/send/abc');
  assert.equal(out[0].claims.aud, 'https://fcm.googleapis.com');
  assert.equal(out[1].claims.aud, 'https://web.push.apple.com');
  assert.equal(out[0].claims.sub, 'mailto:a@b.c');
  const exp = out[0].claims.exp;
  assert.ok(exp > Date.now() / 1000 + 3600 && exp <= Date.now() / 1000 + 12 * 3600 + 5, 'expires within 12 hours (the push services allow at most 24)');
  assert.equal(out[0].vapid_public_key, 'PUB');
});

test('S2 expand: an endpoint that is not https is skipped', () => {
  const state = { vapid_public_key: 'PUB', vapid_subject: 'mailto:a@b.c', supabase_url: 'u' };
  const out = runAll('push_expand.js', [{ statusCode: 200, body: { targets: [{ endpoint: 'http://insecure/x' }, { endpoint: 'javascript:alert(1)' }, { endpoint: 'https://ok.example/p' }] } }], { Guard: state });
  assert.deepEqual(out.map((x) => x.endpoint), ['https://ok.example/p']);
});

test('S2 expand does not need the URL class (the n8n code sandbox has none)', () => {
  const state = { vapid_public_key: 'PUB', vapid_subject: 'mailto:a@b.c', supabase_url: 'u' };
  const code = src('push_expand.js');
  const out = new Function('$input', '$', 'Date', 'URL', code)({ first: () => ({ json: { statusCode: 200, body: { targets: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/abc?x=1' }] } } }) },
    () => ({ first: () => ({ json: state }) }), Date, undefined);
  assert.equal(out[0].json.claims.aud, 'https://fcm.googleapis.com');
});

test('S3 clean: a gone endpoint (404 or 410) is forgotten; a good push or a server error is kept', () => {
  const sent = [{ statusCode: 201 }, { statusCode: 410 }, { statusCode: 404 }, { statusCode: 500 }];   // the answers, in the order the pushes were sent
  const expanded = [1, 2, 3, 4].map((n) => ({ endpoint: 'https://a/' + n }));
  const out = runAll('push_clean.js', sent, { Guard: { supabase_url: 'u' }, Expand: expanded });
  assert.deepEqual(out.map((x) => x.endpoint), ['https://a/2', 'https://a/3']);
  assert.deepEqual(out.map((x) => x.rpc_body), [{ p_endpoint: 'https://a/2' }, { p_endpoint: 'https://a/3' }]);
});

test('wiring: SUB 20 reads targets, signs and sends one push per subscription, and forgets gone endpoints', () => {
  const w = wf.sub20;
  assert.deepEqual(next(w, 'Start'), ['Guard']);
  assert.deepEqual(next(w, 'Guard'), ['Allowed?']);
  assert.deepEqual(next(w, 'Allowed?', 0), ['Read targets']);
  assert.deepEqual(next(w, 'Read targets'), ['Targets?']);
  assert.deepEqual(next(w, 'Targets?', 0), ['Expand']);
  assert.deepEqual(next(w, 'Expand'), ['Sign VAPID']);
  assert.deepEqual(next(w, 'Sign VAPID'), ['Send push']);
  assert.deepEqual(next(w, 'Send push').sort(), ['Clean', 'Trace push']);   // #484: the trace line is a second branch
  assert.deepEqual(next(w, 'Clean'), ['Forget']);
  assert.equal(byName(w, 'Sign VAPID').type, 'n8n-nodes-base.jwt');
  assert.equal(byName(w, 'Sign VAPID').credentials.jwtAuth.name, 'GoServe VAPID');
  const send = byName(w, 'Send push');
  assert.equal(send.parameters.method, 'POST');
  assert.equal(send.parameters.url, "={{ $('Expand').item.json.endpoint }}");   // the JWT node keeps only the token, so the endpoint is paired back from Expand
  const headers = Object.fromEntries(send.parameters.headerParameters.parameters.map((h) => [h.name, h.value]));
  assert.equal(headers.Authorization, "=vapid t={{ $json.token }}, k={{ $('Expand').item.json.vapid_public_key }}");
  assert.equal(headers.TTL, '3600');
  assert.equal(send.parameters.options.response.response.neverError, true);   // a 404 or 410 is read in Clean, not thrown
  assert.equal(send.continueOnFail, undefined);
  assert.equal(w.settings.errorWorkflow, 'ALERT1');
});

test('safety: SUB 20 accepts calls only from MAIN 34 (the drain); the private key is never in the build', () => {
  assert.equal(wf.sub20.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(wf.sub20.settings.callerIds, 'MAIN34');
  const all = JSON.stringify(wf);
  assert.ok(!/BEGIN (EC )?PRIVATE KEY/.test(all));
  assert.equal(byName(wf.main34, 'Config').parameters.assignments.assignments.find((a) => a.name === 'vapid_public_key').value, 'PUBKEY');
});

test('names and layout', () => {
  assert.equal(wf.sub20.name, 'GS SUB 20 Push');
  assert.deepEqual(checkLayout(wf.sub20, wf.sub20.sections), []);
  assert.deepEqual(checkLayout(wf.main01, wf.main01.sections), []);
});

test('deploy: SUB 20 is deployed before MAIN 01 and its credential is looked up, never created by the script', () => {
  const { ORDER, NAMES } = require('./deploy');
  assert.ok(ORDER.indexOf('sub20') > -1 && ORDER.indexOf('sub20') < ORDER.indexOf('main01'));
  assert.equal(NAMES.sub20, wf.sub20.name);
  const deploySrc = fs.readFileSync(path.join(__dirname, 'deploy.js'), 'utf8');
  assert.match(deploySrc, /GoServe VAPID/);
  assert.ok(!/POST', '\/credentials/.test(deploySrc), 'the script must not create credentials');
});

// Story #484: every push send leaves a line in order_trace, so "what did the push service answer" is never a guess.
const ORDER_ID = '0f0f0f0f-0000-4000-8000-000000000001';

test('T1 guard passes the order id on, so the trace line belongs to the order', () => {
  const good = { kill_switch: false, supabase_url: 'u', session_id: SESSION, order_id: ORDER_ID, status: 'ready', vapid_public_key: 'PUB', vapid_subject: 'mailto:a@b.c' };
  assert.equal(run('guard_push.js', good).order_id, ORDER_ID);
  assert.equal(run('guard_push.js', { ...good, order_id: undefined }).order_id, null);   // an old caller still works; the line just has no order
});

test('T2 trace row: one line per push with the push host and the HTTP status, never the full address or a key', () => {
  const sent = [{ statusCode: 201, body: '' }, { statusCode: 403, body: { reason: 'BadJwtToken' } }, { statusCode: undefined, body: undefined }];
  const expanded = [1, 2, 3].map((n) => ({ endpoint: 'https://web.push.apple.com/SECRET' + n, vapid_public_key: 'PUBKEY' }));
  const out = runAll('push_trace.js', sent, { Guard: { supabase_url: 'u', order_id: ORDER_ID, status: 'ready' }, Expand: expanded });
  assert.equal(out.length, 1);
  assert.equal(out[0].supabase_url, 'u');
  const rows = out[0].rpc_body;
  assert.deepEqual(rows.map((r) => [r.actor, r.event, r.result, r.order_id]), [['n8n', 'push_sent', '201', ORDER_ID], ['n8n', 'push_sent', '403', ORDER_ID], ['n8n', 'push_sent', 'none', ORDER_ID]]);
  assert.equal(rows[1].detail.host, 'web.push.apple.com');
  assert.match(rows[1].detail.text, /BadJwtToken/);
  assert.match(rows[0].detail.text, /^ready/);   // the status that was pushed
  assert.ok(!/SECRET|PUBKEY/.test(JSON.stringify(rows)));
});

test('T3 no subscription is a line too', () => {
  const out = run('push_trace_none.js', { statusCode: 200, body: { targets: [] } }, { Guard: { supabase_url: 'u', order_id: ORDER_ID, status: 'placed' } });
  assert.deepEqual(out.rpc_body.map((r) => [r.actor, r.event, r.result, r.order_id]), [['n8n', 'push_skipped', 'no_subscription', ORDER_ID]]);
});

test('T4 wiring: both traces end in one write node that posts to order_trace; the push itself does not wait for it', () => {
  const w = wf.sub20;
  assert.deepEqual(next(w, 'Send push').sort(), ['Clean', 'Trace push']);
  assert.deepEqual(next(w, 'Targets?', 1), ['Trace none']);
  assert.deepEqual(next(w, 'Trace push'), ['Write trace']);
  assert.deepEqual(next(w, 'Trace none'), ['Write trace']);
  assert.equal(byName(w, 'Write trace').parameters.url, '={{ $json.supabase_url }}/rest/v1/order_trace');
  assert.equal(byName(w, 'Write trace').parameters.jsonBody, '={{ $json.rpc_body }}');
  assert.equal(byName(wf.main34, 'Call SUB 20 Push').parameters.workflowInputs.value.order_id, '={{ $json.order_id }}');
  assert.deepEqual(checkLayout(w, w.sections), []);
});
