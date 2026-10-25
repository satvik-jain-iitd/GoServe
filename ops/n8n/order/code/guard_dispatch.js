// SUB 33, node "Guard": the kill switch, then one database function with no input. dispatch_tick() decides by itself whether batch mode is on.
const j = $input.first().json;
if (j.kill_switch === true) return [{ json: { ok: false, status_code: 503, error: 'kill_switch', message: 'Dispatch is paused.' } }];
return [{ json: { ok: true, supabase_url: j.supabase_url, rpc_body: {} } }];
