// MAIN 90, node "Prepare window": the scorecard day starts at midnight in India (UTC+05:30) and runs until now.
const j = $input.first().json;
const IST = 5.5 * 3600 * 1000;
const now = j.now ? Date.parse(j.now) : Date.now();   // `now` is only for tests
const local = now + IST;
const start = Math.floor(local / 86400000) * 86400000 - IST;
return [{ json: Object.assign({}, j, { since: new Date(start).toISOString(), date: new Date(local).toISOString().slice(0, 10) }) }];
