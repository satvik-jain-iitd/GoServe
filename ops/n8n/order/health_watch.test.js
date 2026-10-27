// Story #488 (phase 1): the daily card shows each Supabase free limit as "x of limit (pct)", a Health line, and an alert at 80%. No new secret.
// Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { checkLayout } = require('../lib/layout_checks');

const IDS = { main01: 'MAIN1', sub91: 'SUB91', sub93: 'SUB93', sub94: 'SUB94', main90: 'MAIN90', main92: 'MAIN92', main93: 'MAIN93', alert: 'ALERT1' };
const wf = build({ ids: IDS, chatId: '42' });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, input, named = {}) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, (n) => {
  if (!(n in named)) throw new Error('Referenced node does not exist: ' + n);
  const v = named[n];
  return { first: () => ({ json: v }), all: () => (Array.isArray(v) ? v : [v]).map((json) => ({ json })) };
}).map((x) => x.json);
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);
const ok = (b) => ({ statusCode: 200, body: b });

const db = (over = {}) => ok({ db_mb: 42.3, storage_mb: 0.3, users: 163, users_active_30d: 40, connections: 9, rows: { orders: 30, run_log: 5, rider_pings: 100, order_events: 90 },
  oldest: {}, caps: { openrouter_usd: 2, supabase_mb: 500, n8n_errors_day: 5 }, ai: { jev_calls_today: 0, jev_cap: 0, jev_cost_today: 0 }, ...over });
const reads = (over) => ({ Start: { since: '2026-10-26T00:00:00.000Z', days: 1, supabase_url: 'u', uptimerobot_key: 'k' }, 'Read OpenRouter': ok({ data: { usage: 0, limit: 2 } }),
  'Read database numbers': over || db(), 'Read n8n errors': ok({ data: [] }), 'Read uptime': ok({ stat: 'ok', monitors: [] }) });
const lines = (over) => run('health_lines.js', {}, reads(over))[0].lines;

test('W1 each limit reads "x of limit (pct%)" with a mark', () => {
  const l = lines();
  assert.ok(l.includes('Database size: 42.3 of 500 MB (8%) · OK'), l.join('\n'));
  assert.ok(l.includes('Storage: 0.3 of 1024 MB (0%) · OK'), l.join('\n'));
  assert.ok(l.includes('Auth users: 163 of 50000 (0%) · OK (all users; monthly active users are fewer)'), l.join('\n'));
});

test('W2 80% of a limit is OVER, half is WATCH', () => {
  const l = lines(db({ db_mb: 400, storage_mb: 600, users: 40000 }));
  assert.ok(l.some((x) => x.startsWith('Database size: 400 of 500 MB (80%) · OVER')));
  assert.ok(l.some((x) => x.startsWith('Storage: 600 of 1024 MB (59%) · WATCH')));
  assert.ok(l.some((x) => x.startsWith('Auth users: 40000 of 50000 (80%) · OVER')));
});

test('W3 egress is a named gap: no source, never "x of 5 GB"', () => {
  const e = lines().find((x) => x.startsWith('Egress'));
  assert.equal(e, 'Egress (limit 5 GB): no source, read the Supabase dashboard');
});

test('W4 Health: OK when the database answered; UNHEALTHY when it did not', () => {
  assert.equal(lines()[0], 'Health: OK');
  const l = lines({ statusCode: 500, body: { message: 'secret db text' } });
  assert.equal(l[0], 'Health: UNHEALTHY (the database did not answer)');
  assert.ok(!l.join('\n').includes('secret db text'));
});

test('W5 a database that predates 0046 (no storage or users) says "could not read" for those, nothing breaks', () => {
  const old = db(); delete old.body.storage_mb; delete old.body.users;
  const l = lines(old);
  assert.ok(l.includes('Storage: could not read'));
  assert.ok(l.includes('Auth users: could not read'));
});

test('W6 the limit alert is one message with only the OVER and UNHEALTHY lines; nothing when all is well', () => {
  const named = (ls) => ({ 'Call SUB 94 Health and cost numbers': { ok: true, lines: ls }, Config: { chat_id: '42' } });
  assert.deepEqual(run('health_alert.js', {}, named(['Health: OK', 'Database size: 1 of 500 MB (0%) · OK', 'Egress (limit 5 GB): no source, read the Supabase dashboard'])), []);
  const out = run('health_alert.js', {}, named(['Health: OK', 'Database size: 410 of 500 MB (82%) · OVER', 'Storage: 1 of 1024 MB (0%) · OK']));
  assert.equal(out.length, 1);
  assert.equal(out[0].chat_id, '42');
  assert.match(out[0].text, /Database size: 410 of 500 MB \(82%\) · OVER/);
  assert.ok(!/Storage/.test(out[0].text));
  const bad = run('health_alert.js', {}, named(['Health: UNHEALTHY (the database did not answer)']));
  assert.match(bad[0].text, /UNHEALTHY/);
  assert.deepEqual(run('health_alert.js', {}, { 'Call SUB 94 Health and cost numbers': { ok: false }, Config: { chat_id: '42' } }), []);
});

test('W7 wiring: MAIN 90 reads the health numbers through SUB 94 and sends the alert as a second message', () => {
  const m = wf.main90;
  assert.deepEqual(next(m, 'Call SUB 91 Scorecard numbers'), ['Call SUB 94 Health and cost numbers']);
  assert.deepEqual(next(m, 'Call SUB 94 Health and cost numbers'), ['Format message']);
  assert.deepEqual(next(m, 'Send scorecard').sort(), ['Limit alert', 'Prune ping history']);
  assert.deepEqual(next(m, 'Limit alert'), ['Send limit alert']);
  assert.equal(byName(m, 'Call SUB 94 Health and cost numbers').parameters.workflowId.value, 'SUB94');
  assert.deepEqual(wf.sub94.settings.callerIds.split(',').sort(), ['MAIN90', 'MAIN93']);
  assert.deepEqual(checkLayout(m, m.sections), []);
});

test('W8 the card shows the health lines every day, not only in reports', () => {
  assert.ok(!/const health = report \?/.test(src('score_message.js')), 'the health lines were gated to reports');
});
