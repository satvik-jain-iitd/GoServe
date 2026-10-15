// SUB 13, node "Decision stored": the SUB's output. The decision is returned only if the row was stored.
const res = $input.first().json || {};
const d = $('Decide').first().json;
if ([200, 201, 204].includes(res.statusCode)) {
  return [{ json: { ok: true, status_code: 200, decision: d.log_row.decision, cost: d.cost } }];
}
return [{ json: { ok: false, status_code: 502, error: 'database_error', message: 'Something went wrong. Please try again.' } }];
