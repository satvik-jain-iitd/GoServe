// MAIN 90 and MAIN 93, node "Prepare window": the card covers the last `days` days (default 1), so a row is in some card whatever the hour it was written.
// The same length just before it is the "before" window of the reports.
const j = $input.first().json;
const IST = 5.5 * 3600 * 1000;   // India is UTC+05:30
const now = j.now ? Date.parse(j.now) : Date.now();   // `now` is only for tests
const days = Number(j.days) || 1;
const span = days * 24 * 3600 * 1000;
const iso = (t) => new Date(t).toISOString();
const until_label = new Date(now + IST).toISOString().slice(0, 16).replace('T', ' ');
const period_label = days === 1 ? 'last 24 hours' : 'last ' + days + ' days';
return [{ json: Object.assign({}, j, { since: iso(now - span), until: iso(now), prev_since: iso(now - 2 * span), prev_until: iso(now - span), until_label, period_label }) }];
