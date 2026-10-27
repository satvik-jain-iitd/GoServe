// Story #354: POST /orders/{id}/rating in the same function (the food and rider scores of a delivered order).
// Story #347: POST /orders. Re-quote the cart (the only bill math, #345), compare with the price the customer saw, then place the order in one
// database transaction (place_order_v2), which checks the kitchen, the dishes, the add-ons and the item total again.
// The same idempotency key answers the same order. The data sources are injected so the tests need no network.
import { live as liveQuote, parse, runQuote, type Deps as QuoteDeps } from "../quote/index.ts";
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

type Placed = { ok: true; created: boolean; order: Record<string, unknown> } | { ok: false; error: string; message: string };
export type Deps = QuoteDeps & {
  session: (req: Request) => Promise<string | null>;   // who is asking: the login's user id, or null
  existing: (session: string, key: string) => Promise<Record<string, unknown> | null>;   // story #537: the order this caller already made with this key
  rate: (order: string, session: string, food: number, rider: number | null, comment: string | null) => Promise<{ ok: true } | { ok: false; error: string; message: string }>;   // story #354
  place: (session: string, key: string, kitchen: string, lines: unknown, address: string, itemTotal: number, bill: Record<string, unknown>) => Promise<Placed>;
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const bad = () => json(400, { ok: false, error: "invalid_request" });
const RATING_STATUS: Record<string, number> = { order_not_found: 404, not_delivered: 409, already_rated: 409 };   // anything else the database refuses is 422
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_FIELDS = ["id", "kitchen_id", "status", "total_paise", "address", "items", "bill", "created_at"];

async function rateOrder(deps: Deps, req: Request, id: string, b: any): Promise<Response> {
  const food = b?.food_score, rider = b?.rider_score ?? null, note = b?.comment ?? null;
  if (!UUID.test(id) || !Number.isInteger(food) || (rider !== null && !Number.isInteger(rider)) || (note !== null && typeof note !== "string")) return bad();
  try {
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized" });
    const res = await deps.rate(id, session, food, rider, note === null ? null : note.trim() || null);
    return res.ok ? json(200, { ok: true }) : json(RATING_STATUS[res.error] ?? 422, { ok: false, error: res.error, message: res.message });
  } catch {
    return json(502, { ok: false, error: "order_unavailable" });   // no detail: a database message must never reach an app
  }
}

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  let b: any;
  try { b = await req.json(); } catch { return bad(); }
  const rating = new URL(req.url).pathname.match(/\/orders\/([^/]+)\/rating\/?$/);
  if (rating) return await rateOrder(deps, req, rating[1], b);
  const q = parse(b);
  const key = b?.idempotency_key, expected = b?.expected_to_pay_paise, text = b?.address?.text;
  if (!q || typeof key !== "string" || key.length < 8 || key.length > 64 || !Number.isInteger(expected) || expected < 0
    || typeof text !== "string" || text.trim().length === 0 || text.length > 300) return bad();
  try {
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized" });
    // A retry (a double tap, a phone that retried after a drop) gets the order it already made, before the dish or the price is looked at again.
    const prior = await deps.existing(session, key);
    if (prior) return json(200, { ok: true, created: false, order: Object.fromEntries(ORDER_FIELDS.map((f) => [f, prior[f]])) });
    const out = await runQuote(deps, q);
    if (!out.ok) return json(422, out.error === "dish_sold_out" ? { ...out, error: "sold_out" } : out);
    const quote = { ...out, kitchen_id: q.kitchen };
    if (out.to_pay_paise !== expected) return json(409, { ok: false, error: "price_changed", message: "A price changed. Check the bill again.", quote });
    const { ok: _ok, lines: _lines, offers: _offers, ...bill } = out;   // the offers are for the screen, not for the order
    const res = await deps.place(session, key, q.kitchen, q.lines, text.trim(), out.item_total_paise, { ...bill, lines: out.lines });
    if (!res.ok) return json(res.error === "price_changed" ? 409 : 422, { ok: false, error: res.error, message: res.message });
    const order = Object.fromEntries(ORDER_FIELDS.map((f) => [f, res.order[f]]));
    return json(res.created ? 201 : 200, { ok: true, created: res.created, order });
  } catch {
    return json(502, { ok: false, error: "order_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data sources. The login is read from the caller's own token (an anonymous user has one too); the order is written with the service key.
const live: Deps = {
  ...liveQuote,
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  existing: async (session, key) => {
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/orders?select=${ORDER_FIELDS.join(",")}&session_id=eq.${encodeURIComponent(session)}&client_order_key=eq.${encodeURIComponent(key)}&limit=1`,
      { headers: { apikey: service, authorization: `Bearer ${service}` } });
    if (!res.ok) throw new Error("read failed");
    return (await res.json())[0] ?? null;
  },
  rate: async (order, session, food, rider, comment) => {
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/rate_order_v2`, {
      method: "POST", headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" },
      body: JSON.stringify({ p_order: order, p_session: session, p_food: food, p_rider: rider, p_comment: comment }),
    });
    if (!res.ok) throw new Error("rate failed");
    return await res.json();
  },
  place: async (session, key, kitchen, lines, address, itemTotal, bill) => {
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/place_order_v2`, {
      method: "POST", headers: { apikey: service, authorization: `Bearer ${service}`, "content-type": "application/json" },
      body: JSON.stringify({ p_session: session, p_key: key, p_kitchen: kitchen, p_lines: lines, p_address: address, p_item_total: itemTotal, p_bill: bill }),
    });
    if (!res.ok) throw new Error("place failed");
    return await res.json();
  },
};
export const handler = withRunLog("orders", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
