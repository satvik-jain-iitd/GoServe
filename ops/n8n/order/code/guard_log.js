// SUB 14, node "Guard": checks the fields of one run and builds the run_log row. A log write is not blocked by the kill switch: refusals are worth logging.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const cost = j.cost === undefined || j.cost === null ? 0 : j.cost;
if (!text(j.session_id, 64) || !uuid.test(String(j.kitchen_id)) || !text(j.workflow, 120)
  || !Number.isFinite(j.duration_ms) || j.duration_ms < 0 || !Number.isFinite(j.params_version) || !Number.isFinite(cost) || cost < 0) {
  return refuse(400, 'invalid_request', 'The run log is missing something.');
}
return [{ json: { ok: true, supabase_url: j.supabase_url, log_row: { session_id: j.session_id, kitchen_id: j.kitchen_id, workflow: j.workflow,
  params_version: j.params_version, duration_ms: Math.round(j.duration_ms), cost, error: j.error ? String(j.error).slice(0, 200) : null } } }];
