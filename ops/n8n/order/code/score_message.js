// MAIN 90, node "Format message": one plain-text message for the owner. Numbers are shown in pairs: runs with errors, time with its worst case,
// decisions with Jev use and agreement, cost with cost per decision.
const r = $input.first().json;
const chat_id = $('Config').first().json.chat_id;
const head = 'GoServe scorecard, ' + $('Prepare window').first().json.date;
if (!r.ok) return [{ json: { chat_id, text: head + '\nI could not read today\'s numbers (' + (r.error || 'error') + '). Please check the database.' } }];
const s = r.summary;
const lines = [head];
if (s.runs === 0) lines.push('No runs today.');
else {
  lines.push('Runs: ' + s.runs + ', errors: ' + s.errors + ' (' + Math.round((100 * s.errors) / s.runs) + '%)');
  lines.push('Time per run: ' + s.avg_ms + ' ms on average, ' + s.max_ms + ' ms at most');
}
lines.push('Decisions: ' + s.decisions + '. Jev advice used: ' + s.jev_used + ', agreed with the rule: ' + s.jev_agreed);
lines.push('Cost: $' + s.cost.toFixed(5) + (s.decisions ? ' (about $' + (s.decide_cost / s.decisions).toFixed(5) + ' per decision)' : ''));
lines.push('Health checks: ' + s.health_checks);
if (s.truncated) lines.push('Note: first 1000 runs only; the day had more.');
return [{ json: { chat_id, text: lines.join('\n') } }];
