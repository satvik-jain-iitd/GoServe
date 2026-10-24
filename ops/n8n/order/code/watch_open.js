// MAIN 92, node "Open now?": the watch speaks only in open hours, India time. `now` is only for tests.
const j = $input.first().json;
const IST = 5.5 * 3600 * 1000;
const now = j.now ? Date.parse(j.now) : Date.now();
const t = new Date(now + IST).toISOString().slice(11, 16);   // HH:MM in India
return [{ json: Object.assign({}, j, { open: t >= j.open_from && t <= j.open_to }) }];
