// SUB 32, node "Shape result": the database answer becomes a short answer with a status code. Raw database text never goes back to the admin app.
const res = $input.first().json;
const body = res.body && typeof res.body === 'object' ? res.body : {};
const out = (status_code, extra) => [{ json: Object.assign({ ok: status_code < 300, status_code }, extra) }];
if (res.statusCode === 200 && body.ok === true) return out(200, body);
const msg = String(body.message || '');
if (msg === 'not_admin') return out(403, { error: 'not_admin', message: 'Only an admin can change this.' });
if (msg === 'laya_not_deployed') return out(409, { error: 'laya_not_deployed', message: 'Laya is not deployed yet.' });
if (msg === 'invalid_engine') return out(400, { error: 'invalid_engine', message: 'Engine must be rules, jev or laya.' });
if (res.statusCode === 401 || body.code === 'PGRST301' || /JWT/.test(msg)) return out(401, { error: 'not_signed_in', message: 'Please sign in again.' });
return out(502, { error: 'database_error', message: 'Something went wrong. Please try again.' });
