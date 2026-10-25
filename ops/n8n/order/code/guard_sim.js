// SUB 30, node "Guard": the kill switch again (rulebook 95.15), then the shape. Numbers are clamped so a typo cannot seed a thousand kitchens.
// Actions: seed, reset (H5), tick, enable, disable (H6). Each maps to one database function; the database clamps once more.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'The simulator is paused.');
const FN = { seed: 'sim_seed', reset: 'sim_reset', tick: 'sim_tick', enable: 'sim_enable', disable: 'sim_enable' };
if (!FN[j.action]) return refuse(400, 'bad_action', 'Action must be seed, reset, tick, enable or disable.');
const clamp = (v, d, lo, hi) => { const n = Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : d; return Math.min(hi, Math.max(lo, n)); };
const b = j.body || {};
const P = {
  seed: () => ({ kitchens: clamp(b.kitchens, 10, 1, 50), riders: clamp(b.riders, 20, 1, 200), dishes_per_kitchen: clamp(b.dishes_per_kitchen, 6, 1, 12),
    seed: clamp(b.seed, 42, 0, 2147483647), open_pct: clamp(b.open_pct, 80, 0, 100), online_pct: clamp(b.online_pct, 70, 0, 100) }),
  reset: () => null,
  tick: () => ({ move_min_m: clamp(b.move_min_m, 100, 0, 2000), move_max_m: clamp(b.move_max_m, 300, 0, 2000), kitchen_flip_pct: clamp(b.kitchen_flip_pct, 10, 0, 100), dish_flip_pct: clamp(b.dish_flip_pct, 5, 0, 100) }),
  enable: () => ({ enabled: true }),
  disable: () => ({ enabled: false }),
};
const p = P[j.action]();
return [{ json: { ok: true, supabase_url: j.supabase_url, rpc_fn: FN[j.action], rpc_body: p ? { p } : {} } }];
