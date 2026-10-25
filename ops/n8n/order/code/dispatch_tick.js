// MAIN 33, node "Tick": the schedule carries no body, so this item hands SUB 33 what it needs.
const j = $input.first().json;
return [{ json: { kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, env: j.env, started_at: Date.now() } }];
