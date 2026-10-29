// MAIN 34, node "Expand rows": one item per queued push, with the settings SUB 20 needs. A database error or an empty queue gives no item; the run log shows the status.
const t = $('Tick').first().json;
const r = $input.first().json;
if (r.statusCode !== 200 || !r.body || !Array.isArray(r.body.rows)) return [];
return r.body.rows.map((row) => ({ json: {
  outbox_id: row.id, session_id: row.session_id, order_id: row.order_id, status: row.status, kind: row.kind || 'order', kitchen_id: row.kitchen_id || null,
  vapid_public_key: t.vapid_public_key, vapid_subject: t.vapid_subject, kill_switch: t.kill_switch, supabase_url: t.supabase_url } }));
