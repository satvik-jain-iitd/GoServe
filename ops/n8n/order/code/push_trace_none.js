// SUB 20, node "Trace none": the customer has no push subscription, so nothing was sent. That is a line too (story #484).
const g = $('Guard').first().json;
return [{ json: { supabase_url: g.supabase_url, rpc_body: [{ order_id: g.order_id || null, actor: 'n8n', event: 'push_skipped', result: 'no_subscription', detail: { text: g.status } }] } }];
