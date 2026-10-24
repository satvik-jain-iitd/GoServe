// MAIN 92, node "Prepare marks": after the messages went out, one mark per order and kind (the kitchen copy is the same mark).
const j = $input.first().json;
const seen = new Set();
const marks = [];
for (const i of $('Format message').all()) {
  const k = i.json.order_id + '|' + i.json.kind;
  if (!seen.has(k)) { seen.add(k); marks.push({ order_id: i.json.order_id, kind: i.json.kind }); }
}
return [{ json: { supabase_url: j.supabase_url || $('Config').first().json.supabase_url, rpc_body: JSON.stringify({ p_marks: marks }) } }];
