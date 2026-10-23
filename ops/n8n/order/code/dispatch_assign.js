// SUB 22, node "Prepare assign": the rule's pick (Jev only advises, SUB 13 decides) is the rider to assign. "none" or a failed decision is not a rider.
const start = $('Start').first().json;
const res = $input.first().json || {};
const pick = res.ok && res.decision ? res.decision.chosen_pick : null;
if (!pick || pick === 'none') return [{ json: { ok: false } }];
return [{ json: { ok: true, order_id: start.order_id, rider_id: pick, kill_switch: start.kill_switch, supabase_url: start.supabase_url } }];
