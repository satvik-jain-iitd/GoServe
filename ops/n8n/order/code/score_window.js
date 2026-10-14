// MAIN 90, node "Prepare window": the card covers the last 24 hours, so a row is in some card whatever the hour it was written.
const j = $input.first().json;
const IST = 5.5 * 3600 * 1000;   // India is UTC+05:30
const now = j.now ? Date.parse(j.now) : Date.now();   // `now` is only for tests
const until_label = new Date(now + IST).toISOString().slice(0, 16).replace('T', ' ');
return [{ json: Object.assign({}, j, { since: new Date(now - 24 * 3600 * 1000).toISOString(), until_label }) }];
