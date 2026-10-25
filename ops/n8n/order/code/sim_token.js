// MAIN 30, node "Check token": the simulator's own token (SIM_TOKEN), never the demo token. Body field "action": seed, reset, tick, enable, disable, status, knobs.
const j = $input.first().json;
const body = j.body || {};
const sent = (j.headers || {})['x-gs-sim-token'];
const token_ok = typeof j.sim_token === 'string' && j.sim_token.length > 0 && sent === j.sim_token;
const action = ['seed', 'reset', 'tick', 'enable', 'disable', 'status', 'knobs'].includes(body.action) ? body.action : 'bad';
return [{ json: { token_ok, action, kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, body, started_at: Date.now() } }];
