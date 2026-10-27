// SUB 20, node "Trace refused": the guard said no (kill switch, bad input, a status that is not pushed). That is a line too (story #500).
// Without an order there is nothing to attach the line to, so nothing is written.
const r = $input.first().json;
if (!r.order_id || !r.supabase_url) return [];
return [{ json: { supabase_url: r.supabase_url, rpc_body: [{ order_id: r.order_id, actor: 'n8n', event: 'push_skipped', result: String(r.error || 'refused').slice(0, 60), detail: { text: String((r.status || '') + ' ' + (r.message || '')).trim().slice(0, 300) } }] } }];
