// SUB 14, node "Log written": the SUB's output.
const res = $input.first().json || {};
return [{ json: [200, 201, 204].includes(res.statusCode) ? { ok: true, status_code: 200 } : { ok: false, status_code: 502, error: 'database_error', message: 'The run log was not stored.' } }];
