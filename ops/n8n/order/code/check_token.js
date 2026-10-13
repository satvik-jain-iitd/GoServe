// MAIN 01, node "Check token": decides if the call may go on. The webhook item carries headers and body; Config added the tunables.
const j = $input.first().json;
const body = j.body || {};
const sent = (j.headers || {})['x-gs-token'];
const token_ok = typeof j.demo_token === 'string' && j.demo_token.length > 0 && sent === j.demo_token;
const action = body.action === 'place' || body.action === 'status' ? body.action : 'bad';
return [{ json: { token_ok, action, kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, body } }];
