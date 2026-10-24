// SUB 94, node "Health lines": the platform and cost lines for the weekly and monthly report. Every read is soft: a failed one prints "could not read" and the rest go on.
// Marks: WATCH from half the cap, OVER from 80% of the cap.
const start = $('Start').first().json;
const get = (n) => { try { const r = $(n).first().json; return r && r.statusCode === 200 && r.body ? r.body : null; } catch (e) { return null; } };
const mark = (v, cap) => (v >= 0.8 * cap ? 'OVER' : v >= 0.5 * cap ? 'WATCH' : 'OK');
const num = (x) => String(Number(Number(x).toFixed(4)));
const day = (t) => (t ? String(t).slice(0, 10) : 'none');
const out = [];

const or = get('Read OpenRouter');
const db = get('Read database numbers');
const caps = (db && db.caps) || {};
const orCap = Number(caps.openrouter_usd) || (or && or.data && Number(or.data.limit)) || 0;
if (or && or.data && orCap) out.push('OpenRouter spend: $' + num(or.data.usage) + ' of $' + num(orCap) + ' · ' + mark(Number(or.data.usage), orCap));
else out.push('OpenRouter spend: could not read');

if (db && db.rows) {
  const cap = Number(caps.supabase_mb) || 500;
  out.push('Database size: ' + num(db.db_mb) + ' of ' + cap + ' MB · ' + mark(Number(db.db_mb), cap));
  out.push('Open database connections: ' + db.connections);
  out.push('Rows: ' + ['orders', 'run_log', 'rider_pings', 'order_events'].map((t) => t + ' ' + db.rows[t]).join(', '));
  out.push('Oldest rows: ' + ['orders', 'run_log', 'rider_pings', 'order_events'].map((t) => t + ' ' + day(db.oldest && db.oldest[t])).join(', '));
} else out.push('Database: could not read');

const ex = get('Read n8n errors');
if (ex && Array.isArray(ex.data)) {
  const since = Date.parse(start.since);
  const n = ex.data.filter((e) => Date.parse(e.startedAt) >= since).length;
  const allowed = (Number(caps.n8n_errors_day) || 5) * (Number(start.days) || 1);
  out.push('n8n errors in the window: ' + n + ' of ' + allowed + ' allowed · ' + mark(n, allowed));
} else out.push('n8n errors: could not read');

const up = get('Read uptime');
if (up && up.stat === 'ok' && Array.isArray(up.monitors)) {
  for (const m of up.monitors) out.push('Uptime, ' + m.friendly_name + ': ' + (m.status === 2 ? 'up' : m.status === 0 ? 'paused' : m.status === 1 ? 'not checked yet' : 'DOWN') + ', ' + m.custom_uptime_ratio + '% in 7 days');
} else out.push('Uptime: could not read');
return [{ json: { ok: true, status_code: 200, lines: out } }];
