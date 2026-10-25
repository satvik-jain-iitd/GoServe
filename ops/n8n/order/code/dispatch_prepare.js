// SUB 22, node "Prepare decision": the riders from the database become the input of SUB 13. SUB 13 takes at most ten, so the ten best (by rank, else the ten nearest) go.
const start = $('Start').first().json;
const all = $input.first().json.riders || [];
const ranked = all.length > 0 && all.every((r) => Number.isFinite(r.rank));   // story #272: the database ranks the riders
const riders = all.slice().sort(ranked ? (a, b) => a.rank - b.rank : (a, b) => a.distance_m - b.distance_m).slice(0, 10);
return [{ json: { session_id: start.session_id, kitchen_id: start.kitchen_id, order_id: start.order_id, riders, params_version: start.params_version,
  jev_enabled: start.jev_enabled, jev_model: start.jev_model, jev_cost_cap: start.jev_cost_cap, kill_switch: start.kill_switch, supabase_url: start.supabase_url } }];
