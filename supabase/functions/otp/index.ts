// Story #339: POST /otp/send and POST /otp/verify. Phone login by a six digit code.
// TEST DOUBLE: the SMS sender is injected (`sms`). The dev sender, FakeSms, delivers nothing: the code only exists as a hash in `otp_codes`, and a test or the
// owner can read it with the service key. The real sender is one function and one env var (OTP_SMS_PROVIDER), added when the owner picks and clicks the
// provider (docs/product/founder-checklist.md). Until then this endpoint cannot log a real customer in.
// The rules (3 sends in 10 minutes, 5 tries, 10 minutes, one use) are in the database. On the right code the phone is linked to the CALLER's own user,
// so the user id does not change and the guest orders stay with the account. A phone that already belongs to another user answers phone_in_use.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

type Refusal = { ok: false; error: string; message: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  issue: (phone: string) => Promise<{ ok: true; code: string; expires_in_s: number } | Refusal>;
  sms: (phone: string, code: string) => Promise<void>;
  check: (phone: string, code: string) => Promise<{ ok: true; phone: string } | Refusal>;
  link: (userId: string, phone: string) => Promise<{ ok: true } | Refusal>;
};
const STATUS: Record<string, number> = { invalid_phone: 400, too_many_sends: 429, too_many_attempts: 429, wrong_code: 422, code_expired: 422, no_code: 422, phone_in_use: 409 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (r: Refusal) => json(STATUS[r.error] ?? 422, { ok: false, error: r.error, message: r.message });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const route = new URL(req.url).pathname.split("/").pop();
  if (route !== "send" && route !== "verify") return json(404, { ok: false, error: "not_found" });
  let b: any;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: "invalid_request" }); }
  const bad = typeof b?.phone !== "string" || (route === "verify" && !/^[0-9]{6}$/.test(b?.code ?? ""));
  try {
    const user = await deps.session(req);
    if (!user) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
    if (bad) return json(400, { ok: false, error: "invalid_request" });
    if (route === "send") {
      const issued = await deps.issue(b.phone);
      if (!issued.ok) return refuse(issued);
      try { await deps.sms("91" + b.phone, issued.code); } catch { return json(502, { ok: false, error: "sms_unavailable" }); }
      return json(200, { ok: true, expires_in_s: issued.expires_in_s });   // never the code
    }
    const checked = await deps.check(b.phone, b.code);
    if (!checked.ok) return refuse(checked);
    const linked = await deps.link(user, checked.phone);
    if (!linked.ok) return refuse(linked);
    return json(200, { ok: true, linked: true, phone: checked.phone, user_id: user });
  } catch {
    return json(502, { ok: false, error: "otp_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data sources. The database rules run with the service key; the login is read from the caller's own token; the link is the Auth admin API.
const url = () => Deno.env.get("SUPABASE_URL")!;
const service = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rpc = async (fn: string, body: Record<string, unknown>) => {
  const res = await fetch(`${url()}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: service(), authorization: `Bearer ${service()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("rpc failed");
  return await res.json();
};
const live: Deps = {
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  issue: (phone) => rpc("otp_send_v2", { p_phone: phone }),
  // FakeSms: delivers nothing. Swap this one line for the provider's sender when the owner clicks.
  sms: async () => {},
  check: (phone, code) => rpc("otp_verify_v2", { p_phone: phone, p_code: code }),
  link: async (userId, phone) => {
    const res = await fetch(`${url()}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: { apikey: service(), authorization: `Bearer ${service()}`, "content-type": "application/json" }, body: JSON.stringify({ phone, phone_confirm: true }) });
    if (res.ok) return { ok: true };
    if ((await res.text()).includes("users_phone_key")) return { ok: false, error: "phone_in_use", message: "This number is already used by another account." };
    throw new Error("link failed");
  },
};
export const handler = withRunLog("otp", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
