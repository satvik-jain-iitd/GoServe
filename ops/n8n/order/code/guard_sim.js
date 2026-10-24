// SUB 30, node "Guard": the kill switch again (rulebook 95.15), then the shape. Numbers are clamped so a typo cannot seed a thousand kitchens.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'The simulator is paused.');
if (!['seed', 'reset'].includes(j.action)) return refuse(400, 'bad_action', 'Action must be seed or reset.');
const clamp = (v, d, lo, hi) => { const n = Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : d; return Math.min(hi, Math.max(lo, n)); };
const b = j.body || {};
const p = j.action === 'seed' ? {
  kitchens: clamp(b.kitchens, 10, 1, 50), riders: clamp(b.riders, 20, 1, 200), dishes_per_kitchen: clamp(b.dishes_per_kitchen, 6, 1, 12),
  seed: clamp(b.seed, 42, 0, 2147483647), open_pct: clamp(b.open_pct, 80, 0, 100), online_pct: clamp(b.online_pct, 70, 0, 100) } : {};
return [{ json: { ok: true, supabase_url: j.supabase_url, rpc_fn: j.action === 'seed' ? 'sim_seed' : 'sim_reset', rpc_body: j.action === 'seed' ? { p } : {} } }];
