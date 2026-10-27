// Story H14 (#204) tests, written BEFORE the code (red first): the pilot block in the day card (marks against the breakpoints),
// GS MAIN 92 Pilot watch with GS SUB 93 Watch numbers, and GS MAIN 93 Weekly and monthly report.
// Run: node --test "ops/n8n/order/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');

const IDS = { main01: 'MAIN1', sub91: 'SUB91', sub93: 'SUB93', sub94: 'SUB94', main90: 'MAIN90', main92: 'MAIN92', main93: 'MAIN93', alert: 'ALERT1' };
const wf = build({ ids: IDS, chatId: '42' });
const src = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
const run = (file, input, named = {}) => new Function('$input', '$', src(file))({ first: () => ({ json: input }) }, (n) => {
  if (!(n in named)) throw new Error('Referenced node does not exist: ' + n);
  const v = named[n];
  return { first: () => ({ json: Array.isArray(v) ? v[0] : v }), all: () => (Array.isArray(v) ? v : [v]).map((json) => ({ json })) };
})[0].json;
const byName = (w, n) => w.nodes.find((x) => x.name === n);
const next = (w, n, i = 0) => w.connections[n].main[i].map((x) => x.node);

const BP = { orders_day: 30, tickets_hour: 10, missed_day: 1, deliveries_rider_hour: 4, radius_km: 3.5, pins: 4, on_time_pct: 80, gap_min: 5, gap_share: 0.2, cash_rider: 8000, refused_pct: 8, ios_share: 0.33, lost_week: 2, calls_share: 0.2, realtime: 200 };
const NUM = { orders_day: 12, tickets_hour: 8, missed_day: 0, deliveries_rider_hour: 4, radius_km: null, pins: 2, on_time_pct: 95, gap_share: 0.25, cash_rider: 6500, refused_pct: 2.5, ios_share: 0.2, lost_week: null, calls_share: 0.1, realtime: null };
const card = (numbers, extra = {}) => ({ ok: true, status_code: 200, summary: Object.assign({ runs: 0, errors: 0, health_checks: 0, avg_ms: 0, max_ms: 0, cost: 0, decide_cost: 0, decisions: 0, jev_used: 0, jev_agreed: 0, truncated: false, pilot: { numbers, breakpoints: BP } }, extra) });
const win = { Config: { chat_id: '42' }, 'Prepare window': { until_label: '2026-10-14 22:15', period_label: 'last 24 hours' } };
const text = (r, named = win) => run('score_message.js', r, { 'Call SUB 91 Scorecard numbers': r, ...named }).text;   // the card reads SUB 91 by node name (story #610)

test('H14 marks: OK below 80% of the line, WATCH from 80% of the line, OVER at the line (higher is worse)', () => {
  const t = text(card(Object.assign({}, NUM, { orders_day: 24, tickets_hour: 10, missed_day: 1 })));
  assert.match(t, /^Orders: 24 \/ 30 · WATCH$/m);
  assert.match(t, /^Tickets in the busiest hour: 10 \/ 10 · OVER$/m);
  assert.match(t, /^Missed tickets: 1 \/ 1 · OVER$/m);
  assert.match(t, /^Orders: .*/m);
  assert.match(text(card(NUM)), /^Orders: 12 \/ 30 · OK$/m);
});

test('H14 marks: the on-time share is the other way round: OVER under the line, WATCH within half the way to 100, else OK', () => {
  assert.match(text(card(Object.assign({}, NUM, { on_time_pct: 79 }))), /^Delivered inside 35 min: 79% \/ 80% · OVER$/m);
  assert.match(text(card(Object.assign({}, NUM, { on_time_pct: 85 }))), /^Delivered inside 35 min: 85% \/ 80% · WATCH$/m);
  assert.match(text(card(Object.assign({}, NUM, { on_time_pct: 90 }))), /^Delivered inside 35 min: 90% \/ 80% · OK$/m);
});

test('H14 message: the three daily numbers come first, shares are shown as percent, unmeasured numbers say so', () => {
  const t = text(card(NUM));
  const lines = t.split('\n');
  assert.deepEqual(lines.slice(1, 5), ['Every day:', 'Missed tickets: 0 / 1 · OK', 'Delivered inside 35 min: 95% / 80% · OK', 'Deliveries with a location gap over 5 min: 25% / 20% · OVER']);
  assert.ok(lines.includes('Rest of the day:'));
  assert.ok(lines.includes('iPhone share: 20% / 33% · OK'));
  assert.ok(lines.includes('Radius from the kitchen (km): not measured yet'));
  assert.ok(lines.includes('Cash held by one rider (Rs): 6500 / 8000 · WATCH'));
  assert.ok(!t.includes('{{') && !t.includes('undefined') && !t.includes('NaN'));
});

test('H14 message: a pilot read that failed says so and the system block is still sent', () => {
  const t = text(card(null, { pilot: null }));
  assert.match(t, /Pilot numbers: could not read them\./);
  assert.match(t, /^Decisions: 0\./m);
});

test('H14 report: the week beside the week before, and no health block until H15', () => {
  const named = { Config: { chat_id: '42' }, 'Prepare window': { until_label: '2026-10-19 09:00', period_label: 'last 7 days' }, 'Call SUB 91 before': card(Object.assign({}, NUM, { orders_day: 9, on_time_pct: 88 })), 'Call SUB 91 Scorecard numbers': card(Object.assign({}, NUM, { orders_day: 14 })) };
  const t = text({}, named);
  assert.match(t.split('\n')[0], /^GoServe pilot report, last 7 days \(to 2026-10-19 09:00 India time\)$/);
  assert.match(t, /^Orders: 14 \/ 30 · OK \(before: 9\)$/m);
  assert.match(t, /^Delivered inside 35 min: 95% \/ 80% · OK \(before: 88%\)$/m);
});

test('H14 window: a report window of 7 or 30 days, with the same length just before it', () => {
  const w = run('score_window.js', { now: '2026-10-19T03:30:00Z', days: 7 });   // Monday 09:00 India
  assert.equal(w.until_label, '2026-10-19 09:00');
  assert.equal(w.period_label, 'last 7 days');
  assert.equal(w.since, '2026-10-12T03:30:00.000Z');
  assert.equal(w.prev_since, '2026-10-05T03:30:00.000Z');
  assert.equal(w.prev_until, '2026-10-12T03:30:00.000Z');
});

// ---- the watch ----
const rows = [
  { order_id: 'o1', kind: 'accept_late', kitchen_name: 'Tau Ka Dhaba', minutes: 4, short_id: '0f0f0f0f' },
  { order_id: 'o2', kind: 'rider_late', kitchen_name: 'Tau Ka Dhaba', minutes: 6, short_id: 'abcd1234' },
];
test('H14 watch: open hours are 11:00 to 22:30 India time', () => {
  const at = (iso) => run('watch_open.js', { open_from: '11:00', open_to: '22:30', now: iso }).open;
  assert.equal(at('2026-10-14T05:29:00Z'), false);   // 10:59
  assert.equal(at('2026-10-14T05:30:00Z'), true);    // 11:00
  assert.equal(at('2026-10-14T17:00:00Z'), true);    // 22:30
  assert.equal(at('2026-10-14T17:01:00Z'), false);   // 22:31
});

test('H14 watch: one message per order; the kitchen gets the late-ticket one too when its chat is set; nothing when there are no rows', () => {
  const ok = { ok: true, rows };
  const items = new Function('$input', '$', src('watch_format.js'))({ first: () => ({ json: ok }) }, () => ({ first: () => ({ json: { chat_id: '42', kitchen_chat_id: '' } }) }));
  assert.equal(items.length, 2);
  assert.equal(items[0].json.text, 'Ticket not accepted for 4 min: order 0f0f0f0f at Tau Ka Dhaba. Please open the kitchen app.');
  assert.equal(items[1].json.text, 'Order abcd1234 at Tau Ka Dhaba has been ready for 6 min with no rider.');
  assert.deepEqual(items.map((i) => i.json.chat_id), ['42', '42']);
  const both = new Function('$input', '$', src('watch_format.js'))({ first: () => ({ json: ok }) }, () => ({ first: () => ({ json: { chat_id: '42', kitchen_chat_id: '77' } }) }));
  assert.deepEqual(both.map((i) => i.json.chat_id), ['42', '77', '42']);   // owner, kitchen (late ticket only), owner
  const none = new Function('$input', '$', src('watch_format.js'))({ first: () => ({ json: { ok: true, rows: [] } }) }, () => ({ first: () => ({ json: { chat_id: '42', kitchen_chat_id: '' } }) }));
  assert.equal(none.length, 0);
  const failed = new Function('$input', '$', src('watch_format.js'))({ first: () => ({ json: { ok: false, error: 'database_error' } }) }, () => ({ first: () => ({ json: { chat_id: '42', kitchen_chat_id: '' } }) }));
  assert.equal(failed.length, 0);
});

test('H14 watch: the marks are one per order and kind, taken from the formatted items, and nothing is marked when nothing was sent', () => {
  const items = [
    { order_id: 'o1', kind: 'accept_late', chat_id: '42', text: 'a' }, { order_id: 'o1', kind: 'accept_late', chat_id: '77', text: 'a' },
    { order_id: 'o2', kind: 'rider_late', chat_id: '42', text: 'b' }];
  const m = run('watch_marks.js', { supabase_url: 'https://x.test' }, { 'Format message': items });
  assert.deepEqual(JSON.parse(m.rpc_body).p_marks, [{ order_id: 'o1', kind: 'accept_late' }, { order_id: 'o2', kind: 'rider_late' }]);
  assert.equal(m.supabase_url, 'https://x.test');
});

test('H14 watch: SUB 93 shapes the rows, and a failed read is an error, never raw database text', () => {
  const good = run('watch_shape.js', {}, { 'Read watch': { statusCode: 200, body: rows } });
  assert.deepEqual([good.ok, good.rows.length], [true, 2]);
  const bad = run('watch_shape.js', {}, { 'Read watch': { statusCode: 500, body: { message: 'secret db text' } } });
  assert.deepEqual([bad.ok, bad.error], [false, 'database_error']);
  assert.ok(!JSON.stringify(bad).includes('secret'));
});

test('H14 wiring: MAIN 92 runs every 5 minutes, fail-closed; open hours, SUB 93, format, Telegram, then the orders are marked', () => {
  assert.deepEqual(byName(wf.main92, 'Every 5 minutes').parameters.rule.interval[0], { field: 'cronExpression', expression: '*/5 * * * *' });
  assert.deepEqual(next(wf.main92, 'Every 5 minutes'), ['Config']);
  assert.deepEqual(next(wf.main92, 'Config'), ['Kill switch?']);
  assert.deepEqual([next(wf.main92, 'Kill switch?', 0), next(wf.main92, 'Kill switch?', 1)], [['Paused'], ['Open now?']]);
  assert.deepEqual(next(wf.main92, 'Open now?'), ['Open hours?']);
  assert.deepEqual([next(wf.main92, 'Open hours?', 0), next(wf.main92, 'Open hours?', 1)], [['Call SUB 93 Watch numbers'], ['Closed']]);
  assert.deepEqual(next(wf.main92, 'Call SUB 93 Watch numbers'), ['Format message']);
  assert.deepEqual(next(wf.main92, 'Format message'), ['Send alert']);
  assert.deepEqual(next(wf.main92, 'Send alert'), ['Prepare marks']);
  assert.deepEqual(next(wf.main92, 'Prepare marks'), ['Mark told']);
  assert.match(byName(wf.main92, 'Mark told').parameters.url, /rpc\/pilot_watch_mark/);
  const cfg = Object.fromEntries(byName(wf.main92, 'Config').parameters.assignments.assignments.map((a) => [a.name, a.value]));
  assert.deepEqual([cfg.kill_switch, cfg.accept_min, cfg.rider_min, cfg.open_from, cfg.open_to, cfg.chat_id], [false, 3, 5, '11:00', '22:30', '42']);
  assert.ok('kitchen_chat_id' in cfg);
  assert.equal(wf.main92.settings.timezone, 'Asia/Kolkata');
  assert.equal(wf.main92.settings.errorWorkflow, 'ALERT1');
  const t = byName(wf.main92, 'Send alert');
  assert.equal(t.credentials.telegramApi.name, 'GoServeBot');
  assert.equal(t.parameters.chatId, '={{ $json.chat_id }}');
});

test('H14 wiring: SUB 93 only reads (the read-only pilot_watch function) and only MAIN 92 may call it', () => {
  const http = wf.sub93.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  assert.deepEqual(http.map((n) => n.name), ['Read watch']);
  assert.match(http[0].parameters.url, /rpc\/pilot_watch$/);
  assert.equal(wf.sub93.settings.callerPolicy, 'workflowsFromAList');
  assert.equal(wf.sub93.settings.callerIds, 'MAIN92');
  const call = byName(wf.main92, 'Call SUB 93 Watch numbers').parameters;
  assert.equal(call.workflowId.value, 'SUB93');
  const declared = byName(wf.sub93, 'Start').parameters.workflowInputs.values.map((v) => v.name).sort();
  assert.deepEqual(Object.keys(call.workflowInputs.value).sort(), declared);
});

test('H14 wiring: MAIN 93 has a Monday and a month-start schedule at 09:00 India time; it reads this period and the one before, then sends one message', () => {
  assert.deepEqual(byName(wf.main93, 'Monday 09:00').parameters.rule.interval[0], { field: 'cronExpression', expression: '0 9 * * 1' });
  assert.deepEqual(byName(wf.main93, '1st of the month 09:00').parameters.rule.interval[0], { field: 'cronExpression', expression: '0 9 1 * *' });
  assert.deepEqual(next(wf.main93, 'Monday 09:00'), ['Week']);
  assert.deepEqual(next(wf.main93, '1st of the month 09:00'), ['Month']);
  assert.deepEqual(next(wf.main93, 'Week'), ['Config']);
  assert.deepEqual(next(wf.main93, 'Month'), ['Config']);
  const days = (n) => byName(wf.main93, n).parameters.assignments.assignments.find((a) => a.name === 'days').value;
  assert.deepEqual([days('Week'), days('Month')], [7, 30]);
  assert.deepEqual(next(wf.main93, 'Kill switch?', 1), ['Prepare window']);
  assert.deepEqual(next(wf.main93, 'Prepare window'), ['Call SUB 91 Scorecard numbers']);
  assert.deepEqual(next(wf.main93, 'Call SUB 91 Scorecard numbers'), ['Call SUB 91 before']);
  assert.deepEqual(next(wf.main93, 'Call SUB 91 before'), ['Call SUB 94 Health and cost numbers']);
  assert.deepEqual(next(wf.main93, 'Call SUB 94 Health and cost numbers'), ['Format message']);
  assert.deepEqual(next(wf.main93, 'Format message'), ['Send report']);
  assert.equal(byName(wf.main93, 'Call SUB 91 before').parameters.workflowInputs.value.since, "={{ $('Prepare window').first().json.prev_since }}");
  assert.equal(wf.main93.settings.timezone, 'Asia/Kolkata');
  assert.equal(wf.main93.settings.errorWorkflow, 'ALERT1');
});
