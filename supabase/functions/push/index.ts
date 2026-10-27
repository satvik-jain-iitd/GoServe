// Story #351: POST /push/register and POST /push/notify. TEST DOUBLE: the push service is FakePush until the owner's FCM and Apple Developer clicks (docs/product/founder-checklist.md).
// register: the signed-in app saves its device token and platform. notify: the system (not an app) says an order changed; every device of that customer gets a push with the status text.
// notify is guarded by our own secret (PUSH_NOTIFY_SECRET) in the x-push-secret header. A token the push service says is dead is forgotten.
import { pushFromEnv, type Platform, type Push } from "../_shared/push.ts";
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

type Refusal = { ok: false; error: string; message: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  push: Push;
  register: (session: string, platform: Platform, token: string) => Promise<{ ok: true } | Refusal>;
  job: (order: string) => Promise<{ ok: true; status: string; devices: { platform: Platform; token: string }[] } | Refusal>;
  forget: (token: string) => Promise<void>;
  secret: () => string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS: Record<string, number> = { order_not_found: 404, invalid_request: 400 };
const TEXT: Record<string, string> = {
  placed: "Your order is placed.", accepted: "The kitchen accepted your order.", preparing: "Your order is being cooked.", ready: "Your order is ready.",
  out_for_delivery: "Your order is on the way.", delivered: "Your order was delivered.", cancelled: "Your order was cancelled.",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (r: Refusal) => json(STATUS[r.error] ?? 422, { ok: false, error: r.error, message: r.message });
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
  if (route !== "register" && route !== "notify") return json(404, { ok: false, error: "not_found" });
  let b: any;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: "invalid_request" }); }
  try {
    if (route === "notify") {
      const secret = deps.secret();
      if (!secret) return json(503, { ok: false, error: "notify_not_configured" });
      if (!same(req.headers.get("x-push-secret") ?? "", secret)) return json(401, { ok: false, error: "unauthorized" });
      if (!UUID.test(b?.order_id)) return json(400, { ok: false, error: "invalid_request" });
      const job = await deps.job(b.order_id);
      if (!job.ok) return refuse(job);
      const m = { title: "GoServe", body: TEXT[job.status] ?? "Your order has an update." };
      let sent = 0, failed = 0, forgotten = 0;
      for (const d of job.devices) {
        try {
          if ((await deps.push.send(d.platform, d.token, m)).gone) { await deps.forget(d.token); forgotten++; } else sent++;
        } catch { failed++; }
      }
      return json(200, { ok: true, sent, failed, forgotten });
    }
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
    if ((b?.platform !== "android" && b?.platform !== "ios") || typeof b?.token !== "string" || !b.token.trim()) return json(400, { ok: false, error: "invalid_request" });
    const saved = await deps.register(session, b.platform, b.token);
    return saved.ok ? json(200, { ok: true }) : refuse(saved);
  } catch {
    return json(502, { ok: false, error: "push_unavailable" });   // no detail: a database or push-service message must never reach an app
  }
};

// The real data sources: the database rules with the service key; the login from the caller's own token; the push service from the environment (FakePush by default).
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
  push: await pushFromEnv(),
  register: (session, platform, token) => rpc("register_push_device_v2", { p_session: session, p_platform: platform, p_token: token }),
  job: (order) => rpc("push_job_v2", { p_order: order }),
  forget: async (token) => { await rpc("push_device_forget_v2", { p_token: token }); },
  secret: () => Deno.env.get("PUSH_NOTIFY_SECRET") ?? "",
});
export const handler = withRunLog("push", async (req) => makeHandler(await live())(req), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
