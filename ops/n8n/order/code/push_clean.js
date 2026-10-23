// SUB 20, node "Clean": the push service says 404 or 410 when a subscription is gone for good. Those endpoints are forgotten; everything else is kept.
// The answers come in the order the pushes were sent, so the endpoint is paired back from "Expand".
const g = $('Guard').first().json;
const sent = $('Expand').all();
const out = [];
$input.all().forEach((item, i) => {
  const code = item.json.statusCode;
  if ((code === 404 || code === 410) && sent[i]) out.push({ json: { supabase_url: g.supabase_url, endpoint: sent[i].json.endpoint, rpc_body: { p_endpoint: sent[i].json.endpoint } } });
});
return out;
