// MAIN 34, node "Tick": the schedule carries no body, so this item says how many queued pushes to take. The Config values travel on.
const j = $input.first().json;
return [{ json: { supabase_url: j.supabase_url, kill_switch: j.kill_switch === true, env: j.env, vapid_public_key: j.vapid_public_key, vapid_subject: j.vapid_subject, rpc_body: { p_limit: 20 } } }];
