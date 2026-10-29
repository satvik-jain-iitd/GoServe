// Story #348: POST /payments/create and POST /payments/webhook; story #565: POST /payments/switch-to-cash (the customer pays cash instead). TEST DOUBLE: the gateway is FakeGateway until the owner's Razorpay KYC click (docs/product/founder-checklist.md).
// create: whose order and how much come from the database; the gateway is asked for THAT amount; the payment is stored; the order becomes online and waits for the payment.
// webhook: HMAC-SHA256 over `provider_order_id|provider_payment_id` with our own secret (the Razorpay shape, PAYMENTS_WEBHOOK_SECRET). A bad signature is 400 and writes nothing.
// The gateway JWT check is OFF for this function (supabase/config.toml, story #569), because the real Razorpay webhook has no login. Safe because: create and switch-to-cash
// read the caller's own token here (401 without it), and the webhook is proved by its HMAC signature (400 without a good one). Do not add a route that trusts the caller without one of these.
import { gatewayFromEnv, type Gateway } from "../_shared/gateway.ts";
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";
import { withCors } from "../_shared/cors.ts";

type Refusal = { ok: false; error: string; message: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  gateway: Gateway;
  prepare: (order: string, session: string) => Promise<{ ok: true; amount_paise: number; existing: string | null } | Refusal>;
  store: (order: string, session: string, provider: string, providerOrderId: string) => Promise<{ ok: true } | Refusal>;
  markPaid: (provider: string, providerOrderId: string, providerPaymentId: string) => Promise<{ ok: true; order_id: string; already_paid?: boolean } | Refusal>;
  switchCash: (order: string, session: string) => Promise<{ ok: true } | Refusal>;
  secret: () => string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS: Record<string, number> = { order_not_found: 404, order_not_payable: 409, already_paid: 409, payment_not_found: 404, payment_closed: 409 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (r: Refusal) => json(STATUS[r.error] ?? 422, { ok: false, error: r.error, message: r.message });

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sign(secret: string, providerOrderId: string, providerPaymentId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${providerOrderId}|${providerPaymentId}`)));
}
// Constant time: the time taken does not tell how many characters matched.
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const route = new URL(req.url).pathname.split("/").pop();
  if (route !== "create" && route !== "webhook" && route !== "switch-to-cash") return json(404, { ok: false, error: "not_found" });
  let b: any;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: "invalid_request" }); }
  try {
    if (route === "webhook") {
      const secret = deps.secret();
      if (!secret) return json(503, { ok: false, error: "webhook_not_configured" });
      const ok = typeof b?.provider_order_id === "string" && typeof b?.provider_payment_id === "string" && typeof b?.signature === "string"
        && same(b.signature, await sign(secret, b.provider_order_id, b.provider_payment_id));
      if (!ok) return json(400, { ok: false, error: "invalid_signature" });
      const paid = await deps.markPaid(deps.gateway.provider, b.provider_order_id, b.provider_payment_id);
      return paid.ok ? json(200, { ok: true, order_id: paid.order_id }) : refuse(paid);
    }
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
    if (!UUID.test(b?.order_id)) return json(400, { ok: false, error: "invalid_request" });
    if (route === "switch-to-cash") {
      const done = await deps.switchCash(b.order_id, session);
      return done.ok ? json(200, { ok: true }) : refuse(done);
    }
    const prep = await deps.prepare(b.order_id, session);
    if (!prep.ok) return refuse(prep);
    if (prep.existing) return json(200, { ok: true, provider: deps.gateway.provider, provider_order_id: prep.existing, amount_paise: prep.amount_paise, currency: "INR" });
    const made = await deps.gateway.createOrder(prep.amount_paise, b.order_id);
    const stored = await deps.store(b.order_id, session, deps.gateway.provider, made.provider_order_id);
    if (!stored.ok) return refuse(stored);
    return json(200, { ok: true, provider: deps.gateway.provider, provider_order_id: made.provider_order_id, amount_paise: made.amount_paise, currency: made.currency });
  } catch {
    return json(502, { ok: false, error: "payment_unavailable" });   // no detail: a gateway or database message must never reach an app
  }
};

// The real data sources: the database rules with the service key; the login from the caller's own token; the gateway from the environment (FakeGateway by default).
const url = () => Deno.env.get("SUPABASE_URL")!;
const service = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rpc = async (fn: string, body: Record<string, unknown>) => {
  const res = await fetch(`${url()}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: service(), authorization: `Bearer ${service()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("rpc failed");
  return await res.json();
};
const live = async (): Promise<Deps> => ({
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  gateway: await gatewayFromEnv(),
  prepare: (order, session) => rpc("payment_prepare_v2", { p_order: order, p_session: session }),
  store: (order, session, provider, providerOrderId) => rpc("payment_create_v2", { p_order: order, p_session: session, p_provider: provider, p_provider_order_id: providerOrderId }),
  markPaid: (provider, providerOrderId, providerPaymentId) => rpc("payment_paid_v2", { p_provider: provider, p_provider_order_id: providerOrderId, p_provider_payment_id: providerPaymentId }),
  switchCash: (order, session) => rpc("payment_switch_to_cash_v2", { p_order: order, p_session: session }),
  secret: () => Deno.env.get("PAYMENTS_WEBHOOK_SECRET") ?? "",
});
export const handler = withCors(withRunLog("payments", async (req) => makeHandler(await live())(req), writeRunLog));   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
