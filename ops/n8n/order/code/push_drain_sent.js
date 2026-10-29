// MAIN 34, node "Sent ids" (story #693): SUB 20 has finished for every row that "Expand rows" handed out (a failed SUB 20 stops the run before this node,
// so those rows are not marked and the database offers them again after 2 minutes). Hand the ids to push_outbox_sent. No rows, no call.
const t = $('Tick').first().json;
const ids = $('Expand rows').all().map((x) => x.json.outbox_id).filter((id) => Number.isInteger(id));
if (ids.length === 0) return [];
return [{ json: { supabase_url: t.supabase_url, rpc_body: { p_ids: ids } } }];
