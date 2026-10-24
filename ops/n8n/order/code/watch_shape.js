// SUB 93, node "Shape rows": the orders over a line, or an error. Raw database text is never returned.
const r = $('Read watch').first().json || {};
if (r.statusCode !== 200 || !Array.isArray(r.body)) return [{ json: { ok: false, status_code: 502, error: 'database_error', message: 'Something went wrong. Please try again.' } }];
return [{ json: { ok: true, status_code: 200, rows: r.body } }];
