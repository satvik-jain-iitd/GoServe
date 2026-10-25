// MAIN 32, node "Check request": the admin's own sign-in token rides in the Authorization header (a Supabase JWT, three parts). n8n holds no admin token;
// the database checks is_admin() on it. Body: { action: "get" } or { action: "set", engine: "rules" | "jev" | "laya" }.
const j = $input.first().json;
const body = j.body || {};
const auth = (j.headers || {}).authorization;
const auth_ok = typeof auth === 'string' && auth.length <= 4096 && /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth);
const engines = ['rules', 'jev', 'laya'];
const action = body.action === 'get' ? 'get' : body.action === 'set' && engines.includes(body.engine) ? 'set' : 'bad';
return [{ json: { auth_ok, action, engine: action === 'set' ? body.engine : '', auth: auth_ok ? auth : '', kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, anon_key: j.anon_key } }];
