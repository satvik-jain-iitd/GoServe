// MAIN 30, node "Check request" (story #941): the admin's own sign-in token rides in the Authorization header (a Supabase JWT, three parts). n8n holds no simulator token;
// the next steps ask the database whether the caller is an admin. Body field "action": seed, seed_kitchens, seed_riders, reset, tick, enable, disable, status, knobs.
const j = $input.first().json;
const body = j.body || {};
const auth = (j.headers || {}).authorization;
const auth_ok = typeof auth === 'string' && auth.length <= 4096 && /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth);
const action = ['seed', 'seed_kitchens', 'seed_riders', 'reset', 'tick', 'enable', 'disable', 'status', 'knobs'].includes(body.action) ? body.action : 'bad';
return [{ json: { auth_ok, action, auth: auth_ok ? auth : '', kill_switch: j.kill_switch === true, supabase_url: j.supabase_url, anon_key: j.anon_key, body, started_at: Date.now() } }];
