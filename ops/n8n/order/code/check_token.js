// MAIN 01, node "Check token": decides if the call may go on. The webhook item carries headers and body; Config added the tunables.
const j = $input.first().json;
const body = j.body || {};
const sent = (j.headers || {})['x-gs-token'];
const token_ok = typeof j.demo_token === 'string' && j.demo_token.length > 0 && sent === j.demo_token;
const action = ['place', 'status', 'decide', 'event', 'health', 'feedback', 'confirm'].includes(body.action) ? body.action : 'bad';
return [{ json: { token_ok, action, kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, body, started_at: Date.now(),
  params_version: j.params_version, kitchen_id: j.kitchen_id, jev_enabled: j.jev_enabled, jev_model: j.jev_model, jev_cost_cap: j.jev_cost_cap,
  drive_folder_id: j.drive_folder_id, chat_id: j.chat_id, env: j.env } }];
