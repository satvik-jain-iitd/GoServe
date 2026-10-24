// MAIN 92, node "Format message": one short message per order over a line. The kitchen's own chat also gets the late-ticket one.
const r = $input.first().json;
if (!r.ok || !Array.isArray(r.rows)) return [];   // nothing to say, and nothing is marked
const cfg = $('Config').first().json;
const out = [];
for (const o of r.rows) {
  const text = o.kind === 'accept_late'
    ? 'Ticket not accepted for ' + o.minutes + ' min: order ' + o.short_id + ' at ' + o.kitchen_name + '. Please open the kitchen app.'
    : 'Order ' + o.short_id + ' at ' + o.kitchen_name + ' has been ready for ' + o.minutes + ' min with no rider.';
  out.push({ json: { order_id: o.order_id, kind: o.kind, chat_id: cfg.chat_id, text } });
  if (o.kind === 'accept_late' && cfg.kitchen_chat_id) out.push({ json: { order_id: o.order_id, kind: o.kind, chat_id: cfg.kitchen_chat_id, text } });
}
return out;
