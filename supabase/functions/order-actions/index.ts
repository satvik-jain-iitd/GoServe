// Story #349: POST /order-actions. The one door for every step an order takes after it is placed: accept, prepare, ready, pickup, arriving, deliver,
// confirm, cancel. The caller's own token goes to the database, which reads who is asking (auth.uid()) and decides who may do what (act_on_order).
// This handler only checks the request and maps the answer to a status code. The data source is injected so the tests need no network.
export type Answer = { ok: true; order: Record<string, unknown> } | { ok: false; error: string; message: string };
export type Deps = { act: (token: string, orderId: string, action: string, reason: string | null) => Promise<Answer> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ["accept", "prepare", "ready", "pickup", "arriving", "deliver", "confirm", "cancel"];
const ORDER_FIELDS = ["id", "kitchen_id", "status", "total_paise", "address", "items", "bill", "created_at"];
const STATUS: Record<string, number> = { unauthorized: 401, not_allowed: 403, order_not_found: 404, already_done: 409, illegal_step: 409, cannot_cancel: 409, reason_required: 422, invalid_action: 400, order_action_failed: 500 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  if (!token) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
  let b: any;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: "invalid_request" }); }
  if (!UUID.test(b?.order_id) || !ACTIONS.includes(b?.action) || (b.reason != null && (typeof b.reason !== "string" || b.reason.length > 200))) return json(400, { ok: false, error: "invalid_request" });
  try {
    const res = await deps.act(token, b.order_id, b.action, b.reason?.trim() || null);
    if (!res.ok) return json(STATUS[res.error] ?? 422, { ok: false, error: res.error, message: res.message });
    return json(200, { ok: true, order: Object.fromEntries(ORDER_FIELDS.map((f) => [f, res.order[f]])) });
  } catch {
    return json(502, { ok: false, error: "order_action_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data source: PostgREST with the caller's token, so auth.uid() inside act_on_order is the caller. The anon key only identifies the project.
const live: Deps = {
  act: async (token, orderId, action, reason) => {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/act_on_order`, {
      method: "POST", headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ p_order: orderId, p_action: action, p_arg: reason }),
    });
    if (!res.ok) throw new Error("act failed");
    return await res.json();
  },
};
export const handler = makeHandler(live);

if (import.meta.main) Deno.serve(handler);
