// SUB 91, node "Summarise": the window's numbers from the run_log rows, the decision_log rows and the pilot_numbers answer. Health checks are counted apart from real runs.
const runsRes = $('Read runs').first().json || {};
const decRes = $('Read decisions').first().json || {};
if (runsRes.statusCode !== 200 || decRes.statusCode !== 200 || !Array.isArray(runsRes.body) || !Array.isArray(decRes.body)) {
  return [{ json: { ok: false, status_code: 502, error: 'database_error', message: 'Something went wrong. Please try again.' } }];
}
const pilotRes = $('Read pilot numbers').first().json || {};   // the pilot read may fail on its own: the card still goes out
const pilot = pilotRes.statusCode === 200 && pilotRes.body && pilotRes.body.numbers ? { numbers: pilotRes.body.numbers, breakpoints: pilotRes.body.breakpoints || {} } : null;
const LIMIT = 1000;   // rows asked for in each read
const round = (x) => Math.round(x * 1e8) / 1e8;
const health = runsRes.body.filter((r) => String(r.workflow).endsWith(': health'));
const runs = runsRes.body.filter((r) => !String(r.workflow).endsWith(': health'));
const times = runs.map((r) => Number(r.duration_ms) || 0);
const used = decRes.body.filter((d) => d.decision && d.decision.jev_status === 'ok');
const sum = (rows) => rows.reduce((n, r) => n + (Number(r.cost) || 0), 0);
const decideCost = sum(runs.filter((r) => String(r.workflow).endsWith(': decide')));
return [{ json: { ok: true, status_code: 200, summary: {
  runs: runs.length, errors: runs.filter((r) => r.error).length, health_checks: health.length,
  avg_ms: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0, max_ms: times.length ? Math.max(...times) : 0,
  cost: round(sum(runsRes.body)), decide_cost: round(decideCost),
  decisions: decRes.body.length, jev_used: used.length, jev_agreed: used.filter((d) => d.decision.jev && d.decision.jev.agrees === true).length,
  truncated: runsRes.body.length >= LIMIT || decRes.body.length >= LIMIT, pilot } } }];
