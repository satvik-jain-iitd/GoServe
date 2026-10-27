// Story H15 (#205) tests, written BEFORE the code (red first): GS SUB 94 Health and cost numbers, and its place in GS MAIN 93.
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
})[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);
const ok = (b) => ({ statusCode: 200, body: b });
const bad = { statusCode: 500, body: { message: 'secret db text' } };

const reads = {
  Start: { since: '2026-10-12T03:30:00.000Z', days: 7, supabase_url: 'https://x.test', uptimerobot_key: 'k' },
  'Read OpenRouter': ok({ data: { usage: 0.0007, limit: 2 } }),
  'Read database numbers': ok({ db_mb: 42.3, connections: 9, rows: { orders: 30, run_log: 5, rider_pings: 100, order_events: 90 },
    oldest: { orders: '2026-10-01T05:00:00Z', run_log: '2026-10-02T05:00:00Z', rider_pings: null, order_events: '2026-10-01T05:00:00Z' }, caps: { openrouter_usd: 2, supabase_mb: 500, n8n_errors_day: 5 }, ai: { jev_calls_today: 3, jev_cost_today: 0.00012, jev_cap: 10 } }),
  'Read n8n errors': ok({ data: [{ startedAt: '2026-10-15T10:00:00.000Z' }, { startedAt: '2026-10-14T10:00:00.000Z' }, { startedAt: '2026-10-01T10:00:00.000Z' }] }),
  'Read uptime': ok({ stat: 'ok', monitors: [{ friendly_name: 'App customer', status: 2, custom_uptime_ratio: '99.98' }, { friendly_name: 'Site', status: 9, custom_uptime_ratio: '90.00' }] }),
};
const lines = (named) => run('health_lines.js', {}, named).lines;

test('H15 lines: OpenRouter spend against the cap, database size, connections, rows, oldest rows, n8n errors, uptime', () => {
  const l = lines(reads);
  assert.ok(l.includes('OpenRouter spend: $0.0007 of $2 · OK'));
  assert.ok(l.includes('Database size: 42.3 of 500 MB (8%) · OK'));
  assert.ok(l.includes('Open database connections: 9'));
  assert.ok(l.includes('Rows: orders 30, run_log 5, rider_pings 100, order_events 90'));
  assert.ok(l.includes('Oldest rows: orders 2026-10-01, run_log 2026-10-02, rider_pings none, order_events 2026-10-01'));
  assert.ok(l.includes('n8n errors in the window: 2 of 35 allowed · OK'));   // the third error is older than the window; the cap is 5 a day for 7 days
  assert.ok(l.includes('Uptime, App customer: up, 99.98% in 7 days'));
  assert.ok(l.includes('Uptime, Site: DOWN, 90.00% in 7 days'));
});

test('#253 lines: Laya and Jev calls today, the Jev cap and its cost; cap zero reads as off; old database answer has no AI lines', () => {
  const l = lines(reads);
  assert.ok(l.includes('Jev calls today: 3 of 10 allowed · cost $0.00012 · OK'));
  assert.ok(l.includes('Laya calls today: 0 (not deployed)'));
  const ai = (a) => lines({ ...reads, 'Read database numbers': ok({ ...reads['Read database numbers'].body, ai: a }) }).find((x) => x.startsWith('Jev calls'));
  assert.equal(ai({ jev_calls_today: 0, jev_cost_today: 0, jev_cap: 0 }), 'Jev calls today: 0 of 0 allowed · cost $0 · OFF');
  assert.equal(ai({ jev_calls_today: 8, jev_cost_today: 0.0001, jev_cap: 10 }), 'Jev calls today: 8 of 10 allowed · cost $0.0001 · OVER');
  const old = lines({ ...reads, 'Read database numbers': ok({ ...reads['Read database numbers'].body, ai: undefined }) });
  assert.equal(old.some((x) => x.startsWith('Jev calls') || x.startsWith('Laya calls')), false);
});

test('H15 marks: WATCH from half the cap, OVER from 80% of the cap', () => {
  const spend = (u) => lines({ ...reads, 'Read OpenRouter': ok({ data: { usage: u, limit: 2 } }) }).find((x) => x.startsWith('OpenRouter'));
  assert.equal(spend(0.9), 'OpenRouter spend: $0.9 of $2 · OK');
  assert.equal(spend(1), 'OpenRouter spend: $1 of $2 · WATCH');
  assert.equal(spend(1.6), 'OpenRouter spend: $1.6 of $2 · OVER');
  const db = (mb) => lines({ ...reads, 'Read database numbers': ok({ ...reads['Read database numbers'].body, db_mb: mb }) }).find((x) => x.startsWith('Database size'));
  assert.equal(db(250), 'Database size: 250 of 500 MB (50%) · WATCH');
  assert.equal(db(400), 'Database size: 400 of 500 MB (80%) · OVER');
});

test('H15 soft: a failed read prints "could not read" for its lines and the others still print; no raw database text', () => {
  const l = lines({ ...reads, 'Read OpenRouter': bad, 'Read uptime': { statusCode: 401, body: {} } });
  assert.ok(l.includes('OpenRouter spend: could not read'));
  assert.ok(l.includes('Uptime: could not read'));
  assert.ok(l.some((x) => x.startsWith('Database size: 42.3')));
  assert.ok(!JSON.stringify(l).includes('secret'));
  const none = lines({ ...reads, 'Read database numbers': bad });
  assert.ok(none.includes('Database: could not read'));
  assert.ok(none.includes('n8n errors in the window: 2 of 35 allowed · OK'));
});

test('H15 soft: a read that never ran (node missing from the run) is also "could not read"', () => {
  const partial = { Start: reads.Start };
  const l = lines(partial);
  assert.deepEqual(l, ['Health: UNHEALTHY (the database did not answer)', 'OpenRouter spend: could not read', 'Database: could not read', 'n8n errors: could not read', 'Uptime: could not read']);
});

// ---- the message ----
const BP = { missed_day: 1, on_time_pct: 80, gap_share: 0.2 };
const card = (extra = {}) => ({ ok: true, status_code: 200, summary: Object.assign({ runs: 0, errors: 0, health_checks: 0, avg_ms: 0, max_ms: 0, cost: 0, decide_cost: 0, decisions: 0, jev_used: 0, jev_agreed: 0, truncated: false, pilot: { numbers: { missed_day: 0, on_time_pct: 95, gap_share: 0.1 }, breakpoints: BP } }, extra) });
const win = { Config: { chat_id: '42' }, 'Prepare window': { until_label: '2026-10-19 09:00', period_label: 'last 7 days' } };

test('H15 message: a report ends with the platform block; the day card has none', () => {
  const named = { ...win, 'Call SUB 91 Scorecard numbers': card(), 'Call SUB 91 before': card(), 'Call SUB 94 Health and cost numbers': { ok: true, lines: ['OpenRouter spend: $0.0007 of $2 · OK'] } };
  const t = run('score_message.js', {}, named).text;
  assert.match(t, /\nPlatform health and cost:\nOpenRouter spend: \$0\.0007 of \$2 · OK/);
  const day = run('score_message.js', card(), { Config: { chat_id: '42' }, 'Prepare window': { until_label: 'x', period_label: 'last 24 hours' } }).text;
  assert.ok(!day.includes('Platform health'));
});

test('H15 fallback: a report whose current period could not be read never shows the period before as the current one', () => {
  const named = { ...win, 'Call SUB 91 Scorecard numbers': { ok: false, status_code: 502, error: 'database_error' }, 'Call SUB 91 before': card({ runs: 99 }), 'Call SUB 94 Health and cost numbers': { ok: true, lines: [] } };
  const t = run('score_message.js', {}, named).text;
  assert.match(t, /could not read the numbers/);
  assert.ok(!t.includes('Runs: 99'));
});

// ---- the workflows ----
test('H15 wiring: SUB 94 reads in a row, each read keeps going on error, and only MAIN 93 may call it', () => {
  assert.deepEqual(wf.sub94.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest').map((n) => n.name), ['Read OpenRouter', 'Read database numbers', 'Read n8n errors', 'Read uptime']);
  for (const n of wf.sub94.nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest')) assert.equal(n.onError, 'continueRegularOutput', n.name);
  assert.deepEqual(next(wf.sub94, 'Start'), ['Read OpenRouter']);
  assert.deepEqual(next(wf.sub94, 'Read uptime'), ['Health lines']);
  assert.match(byName(wf.sub94, 'Read OpenRouter').parameters.url, /^https:\/\/openrouter\.ai\/api\/v1\/auth\/key$/);
  assert.match(byName(wf.sub94, 'Read database numbers').parameters.url, /rpc\/health_numbers$/);
  assert.match(byName(wf.sub94, 'Read n8n errors').parameters.url, /\/api\/v1\/executions\?status=error&limit=100$/);
  assert.match(byName(wf.sub94, 'Read uptime').parameters.url, /api\.uptimerobot\.com\/v2\/getMonitors$/);
  assert.equal(wf.sub94.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(wf.sub94.settings.callerIds, 'MAIN90,MAIN93');   // #488: the daily card reads it too
  const call = byName(wf.main93, 'Call SUB 94 Health and cost numbers').parameters;
  assert.equal(call.workflowId.value, 'SUB94');
  const declared = byName(wf.sub94, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
  assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
});

test('H15 wiring: MAIN 93 calls SUB 94 after the two SUB 91 calls and before the message; the UptimeRobot key comes in at deploy time', () => {
  assert.deepEqual(next(wf.main93, 'Call SUB 91 before'), ['Call SUB 94 Health and cost numbers']);
  assert.deepEqual(next(wf.main93, 'Call SUB 94 Health and cost numbers'), ['Format message']);
  const cfg = Object.fromEntries(byName(wf.main93, 'Config').parameters.assignments.assignments.map((a) => [a.name, a.value]));
  assert.equal(cfg.uptimerobot_key, 'REPLACE_AT_DEPLOY');
  const all = JSON.stringify(wf.sub94) + JSON.stringify(wf.main93);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(all));
});

test('H15 canvas layout of SUB 94 and MAIN 93', () => {
  for (const k of ['sub94', 'main93']) assert.deepEqual(checkLayout(wf[k], wf[k].sections), [], k);
});
