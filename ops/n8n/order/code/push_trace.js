// SUB 20, node "Trace push": one order_trace line per push, with the push service host and its HTTP status (story #484). Never the full address or a key.
// The answers come in the order the pushes were sent, so the endpoint is paired back from "Expand".
const g = $('Guard').first().json;
const sent = $('Expand').all();
const rows = $input.all().map((item, i) => {
  const host = /^https:\/\/([^\/?#\s]+)/.exec(String((sent[i] && sent[i].json.endpoint) || ''));
  const b = item.json.body;
  const text = typeof b === 'string' ? b : b === undefined ? '' : JSON.stringify(b);
  return {
    order_id: g.order_id || null, actor: 'n8n', event: 'push_sent', result: item.json.statusCode === undefined ? 'none' : String(item.json.statusCode),
    detail: { host: host ? host[1] : null, text: (g.status + ' ' + text).trim().slice(0, 300) },
  };
});
return [{ json: { supabase_url: g.supabase_url, rpc_body: rows } }];
