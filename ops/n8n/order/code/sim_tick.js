// MAIN 31, node "Tick": the schedule carries no body, so this item says what SUB 30 must do. The movement numbers are SUB 30's defaults.
const j = $input.first().json;
return [{ json: { action: 'tick', body: {}, kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, env: j.env, started_at: Date.now() } }];
