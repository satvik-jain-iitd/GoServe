// MAIN 30, node "Admin answer" (story #941): the database said whether the caller is an admin (rpc is_admin with the caller's own token). Only a plain `true` counts.
// The token is dropped here: SUB 30 never sees it and writes with the service credential, after this check.
const r = $input.first().json;
const c = $('Check request').first().json;
const admin = r.statusCode === 200 && r.body === true;
return [{ json: { admin, action: c.action, body: c.body, kill_switch: c.kill_switch, supabase_url: c.supabase_url } }];
