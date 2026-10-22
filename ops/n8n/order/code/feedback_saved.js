// SUB 17, node "Check saved": only a stored row goes on. Any database refusal is a short 502; raw database text never goes back to the phone.
const res = $input.first().json;
const g = $('Guard').first().json;
const rows = Array.isArray(res.body) ? res.body : [];
if (res.statusCode === 201 && rows[0] && typeof rows[0].id === 'string') return [{ json: Object.assign({}, g, { ok: true, status_code: 201, id: rows[0].id }) }];
return [{ json: { ok: false, status_code: 502, error: 'database_error', message: 'Something went wrong. Please try again.' } }];
