// SUB 30, node "Guard": the kill switch again (rulebook 95.15), then the shape. Numbers are clamped so a typo cannot seed a thousand kitchens.
// Actions: seed, reset (H5), tick, enable, disable (H6), status (H7), knobs (#284: the four scenario knobs). Each maps to one database function; the database clamps once more.
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'The simulator is paused.');
const FN = { seed: 'sim_seed', reset: 'sim_reset', tick: 'sim_tick', enable: 'sim_enable', disable: 'sim_enable', status: 'sim_status', knobs: 'sim_set_knobs' };
if (!FN[j.action]) return refuse(400, 'bad_action', 'Action must be seed, reset, tick, enable, disable, status or knobs.');
const clamp = (v, d, lo, hi) => { const n = Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : d; return Math.min(hi, Math.max(lo, n)); };
const b = j.body || {};
const P = {
  seed: () => ({ riders_per_kitchen: clamp(b.riders_per_kitchen, 4, 1, 20), online_pct: clamp(b.online_pct, 70, 0, 100) }),
  reset: () => null,
  tick: () => ({ move_min_m: clamp(b.move_min_m, 100, 0, 2000), move_max_m: clamp(b.move_max_m, 300, 0, 2000), kitchen_flip_pct: clamp(b.kitchen_flip_pct, 2, 0, 100), dish_flip_pct: clamp(b.dish_flip_pct, 5, 0, 100), rider_flip_pct: clamp(b.rider_flip_pct, 2, 0, 100) }),
  enable: () => ({ enabled: true }),
  disable: () => ({ enabled: false }),
  status: () => null,
  knobs: () => ({ reject_pct: clamp(b.reject_pct, 5, 0, 100), sold_out_pct: clamp(b.sold_out_pct, 3, 0, 100), delay_pct: clamp(b.delay_pct, 10, 0, 100), rider_drop_pct: clamp(b.rider_drop_pct, 2, 0, 100) }),
};
const p = P[j.action]();
return [{ json: { ok: true, supabase_url: j.supabase_url, rpc_fn: FN[j.action], rpc_body: p ? { p } : {} } }];
