// MAIN 01, node "Log run": after the answer went out, build one run row for SUB 14: duration, settings version, cost, error.
const r = $input.first().json;
const c = $('Check token').first().json;
return [{ json: { session_id: String((c.body || {}).session_id || 'unknown'), kitchen_id: c.kitchen_id, workflow: 'GS MAIN 01 Order API: ' + c.action,
  params_version: c.params_version, duration_ms: Math.max(0, Date.now() - c.started_at), cost: typeof r.cost === 'number' ? r.cost : 0,
  error: r.ok === false ? String(r.error || 'error') : '', supabase_url: c.supabase_url } }];
