// MAIN 90 and MAIN 93, node "Format message": one plain-text message for the owner. The pilot block comes first: each number against its breakpoint
// with a mark. OVER = at or past the line. WATCH = within 20% of the line (for the on-time share: less than half the way from the line to 100%).
// Then the system block: runs with errors, time with its worst case, decisions with Jev use and agreement, cost with cost per decision.
const tryNode = (n) => { try { return $(n).first().json; } catch (e) { return null; } };
const before = tryNode('Call SUB 91 before');   // only MAIN 93 has it
const cur = tryNode('Call SUB 91 Scorecard numbers');
const r = before && cur && cur.summary ? cur : $input.first().json;
const chat_id = $('Config').first().json.chat_id;
const w = $('Prepare window').first().json;
const report = w.period_label !== 'last 24 hours';
const head = 'GoServe pilot ' + (report ? 'report' : 'day card') + ', ' + w.period_label + ' (to ' + w.until_label + ' India time)';
if (!r.ok) return [{ json: { chat_id, text: head + '\nI could not read the numbers (' + (r.error || 'error') + '). Please check the database.' } }];
const s = r.summary;

const LABEL = {
  missed_day: 'Missed tickets', on_time_pct: 'Delivered inside 35 min', gap_share: 'Deliveries with a location gap over 5 min',
  orders_day: 'Orders', tickets_hour: 'Tickets in the busiest hour', deliveries_rider_hour: 'Deliveries in one hour, one rider', radius_km: 'Radius from the kitchen (km)',
  pins: 'Pin codes served', cash_rider: 'Cash held by one rider (Rs)', refused_pct: 'Cash refused at the door', ios_share: 'iPhone share',
  lost_week: 'Customers who lost their list this week', calls_share: 'Where-is-my-food calls (share of orders)', realtime: 'Realtime connections',
};
const DAILY = ['missed_day', 'on_time_pct', 'gap_share'];
const REST = ['orders_day', 'tickets_hour', 'deliveries_rider_hour', 'radius_km', 'pins', 'cash_rider', 'refused_pct', 'ios_share', 'lost_week', 'calls_share', 'realtime'];
const LOW_IS_BAD = ['on_time_pct'];
const fmt = (k, v) => (['on_time_pct', 'refused_pct'].includes(k) ? v + '%' : ['gap_share', 'ios_share', 'calls_share'].includes(k) ? Math.round(v * 100) + '%' : String(v));
const mark = (k, v, bp) => {
  if (LOW_IS_BAD.includes(k)) return v < bp ? 'OVER' : v < bp + (100 - bp) / 2 ? 'WATCH' : 'OK';
  return v >= bp ? 'OVER' : v >= 0.8 * bp ? 'WATCH' : 'OK';
};
const pilot = s.pilot;
const prev = before && before.ok && before.summary && before.summary.pilot ? before.summary.pilot.numbers : null;
const line = (k) => {
  const v = pilot.numbers[k];
  if (v === null || v === undefined) return LABEL[k] + ': not measured yet';
  const bp = pilot.breakpoints[k];
  const was = prev && prev[k] !== null && prev[k] !== undefined ? ' (before: ' + fmt(k, prev[k]) + ')' : '';
  return bp === undefined || bp === null ? LABEL[k] + ': ' + fmt(k, v) + was : LABEL[k] + ': ' + fmt(k, v) + ' / ' + fmt(k, bp) + ' · ' + mark(k, v, bp) + was;
};

const lines = [head];
if (!pilot) lines.push('Pilot numbers: could not read them.');
else if (report) lines.push('Numbers against the breakpoints:', ...DAILY.concat(REST).map(line));
else lines.push('Every day:', ...DAILY.map(line), 'Rest of the day:', ...REST.map(line));
lines.push('', 'System, ' + w.period_label + ':');
if (s.runs === 0) lines.push('No runs in the ' + w.period_label + '.');
else {
  lines.push('Runs: ' + s.runs + ', errors: ' + s.errors + ' (' + Math.round((100 * s.errors) / s.runs) + '%)');
  lines.push('Time per run: ' + s.avg_ms + ' ms on average, ' + s.max_ms + ' ms at most');
}
lines.push('Decisions: ' + s.decisions + '. Jev advice used: ' + s.jev_used + ', agreed with the rule: ' + s.jev_agreed);
lines.push('Cost of all calls: $' + s.cost.toFixed(5) + (s.decisions ? ' (about $' + (s.decide_cost / s.decisions).toFixed(5) + ' per decision)' : ''));
lines.push('Health checks: ' + s.health_checks);
if (s.truncated) lines.push('Note: latest 1000 runs only; there were more.');
return [{ json: { chat_id, text: lines.join('\n') } }];
