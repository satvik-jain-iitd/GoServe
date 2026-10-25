// SUB 32, node "Guard": the kill switch, then one database function. The caller's token goes on to the database untouched and is never logged or stored.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Decision changes are paused.');
if (j.action !== 'get' && j.action !== 'set') return refuse(400, 'bad_action', 'Action must be get or set.');
if (j.action === 'set' && !['rules', 'jev', 'laya'].includes(j.engine)) return refuse(400, 'invalid_engine', 'Engine must be rules, jev or laya.');
return [{ json: { ok: true, supabase_url: j.supabase_url, auth: j.auth, anon_key: j.anon_key,
  rpc_fn: j.action === 'get' ? 'get_decision_engine' : 'set_decision_engine', rpc_body: j.action === 'get' ? {} : { p_engine: j.engine } } }];
