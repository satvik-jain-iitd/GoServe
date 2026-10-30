// Story #339: POST /otp/send and POST /otp/verify. Phone login by a six digit code.
// TEST DOUBLE: the SMS sender is injected (`sms`). The dev sender, FakeSms, delivers nothing: the code only exists as a hash in `otp_codes`, and a test or the
// owner can read it with the service key. The real sender is one function and one env var (OTP_SMS_PROVIDER), added when the owner picks and clicks the
// provider (docs/product/founder-checklist.md). Until then this endpoint cannot log a real customer in.
// The rules (3 sends in 10 minutes, 5 tries, 10 minutes, one use) are in the database. On the right code the phone is linked to the CALLER's own user,
// so the user id does not change and the guest orders stay with the account.
// Story #802: a number that already has an account is answered `sign_in: true` on BOTH routes, before a code is issued or a correct one is consumed.
// The customer then gets one code, from Supabase's own phone sign-in, and /otp/claim moves their guest orders over. Before this, a correct code was
// spent on a link that could not succeed, the customer was told their own number belonged to someone else, and a second SMS was needed.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";
import { withCors } from "../_shared/cors.ts";

type Refusal = { ok: false; error: string; message: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  issue: (phone: string) => Promise<{ ok: true; code: string; expires_in_s: number } | Refusal>;
  sms: (phone: string, code: string) => Promise<void>;
  check: (phone: string, code: string) => Promise<{ ok: true; phone: string } | Refusal>;
  link: (userId: string, phone: string) => Promise<{ ok: true } | Refusal>;
  // story #802: who already owns this number, in the stored form (91 plus ten digits). null means nobody.
  owner: (phone: string) => Promise<string | null>;
  // story #558, the returning customer: who a token belongs to, and the one database move of a guest's orders to the signed-in account
  identify: (token: string) => Promise<{ id: string; anonymous: boolean } | null>;
  claim: (from: string, to: string) => Promise<{ ok: true; orders: number } | Refusal>;
};
const STATUS: Record<string, number> = { invalid_phone: 400, too_many_sends: 429, too_many_attempts: 429, wrong_code: 422, code_expired: 422, no_code: 422, phone_in_use: 409, not_signed_in: 403, not_a_guest: 409, same_user: 400, claim_failed: 502 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
// Indian mobiles are stored as 91 plus the ten digits, in otp_codes and in Supabase Auth (migration 20261027210000_otp.sql).
export const stored = (digits: string) => "91" + digits;
const refuse = (r: Refusal) => json(STATUS[r.error] ?? 422, { ok: false, error: r.error, message: r.message });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const route = new URL(req.url).pathname.split("/").pop();
  if (route !== "send" && route !== "verify" && route !== "claim") return json(404, { ok: false, error: "not_found" });
  let b: any;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: "invalid_request" }); }
  if (route === "claim") {
    // The old account's session is the caller's; the guest's token is in the body. Both are real, the caller is signed in, the other is a guest.
    try {
      const callerToken = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
      const caller = callerToken ? await deps.identify(callerToken) : null;
      if (!caller) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
      if (typeof b?.guest_token !== "string" || b.guest_token.length === 0) return json(400, { ok: false, error: "invalid_request" });
      if (caller.anonymous) return json(403, { ok: false, error: "not_signed_in", message: "Sign in to your account first." });
      const guest = await deps.identify(b.guest_token);
      if (!guest) return json(401, { ok: false, error: "unauthorized", message: "The guest session is not valid." });
      if (!guest.anonymous) return json(409, { ok: false, error: "not_a_guest", message: "Only a guest session can be moved." });
      const moved = await deps.claim(guest.id, caller.id);
      return moved.ok ? json(200, { ok: true, moved: moved.orders }) : refuse(moved);
    } catch {
      return json(502, { ok: false, error: "otp_unavailable" });
    }
  }
  const bad = typeof b?.phone !== "string" || (route === "verify" && !/^[0-9]{6}$/.test(b?.code ?? ""));
  try {
    const user = await deps.session(req);
    if (!user) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
    if (bad) return json(400, { ok: false, error: "invalid_request" });
    // Story #802: whoever already holds this number decides the path. Our own code is for a number the caller may keep; a number held by
    // someone else can only be proved by signing in to that account, so no code of ours is issued and none is consumed to find that out.
    const holder = await deps.owner(stored(b.phone));
    if (holder && holder !== user) return json(200, { ok: true, sign_in: true });
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
const identify = async (token: string) => {
  const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.id ? { id: u.id as string, anonymous: u.is_anonymous === true } : null;
};
const live: Deps = {
  identify,
  claim: (from, to) => rpc("claim_guest_orders_v2", { p_from: from, p_to: to }),
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    return token ? ((await identify(token))?.id ?? null) : null;
  },
  // Story #802: one indexed read of auth.users, through a security definer function the service role alone may call.
  owner: async (phone) => (await rpc("otp_phone_owner", { p_phone: phone })) || null,
  issue: (phone) => rpc("otp_send_v2", { p_phone: phone }),
  // FakeSms: delivers nothing. Swap this one line for the provider's sender when the owner clicks.
  sms: async () => {},
  check: (phone, code) => rpc("otp_verify_v2", { p_phone: phone, p_code: code }),
  link: async (userId, phone) => {
    const res = await fetch(`${url()}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: { apikey: service(), authorization: `Bearer ${service()}`, "content-type": "application/json" }, body: JSON.stringify({ phone, phone_confirm: true }) });
    if (res.ok) return { ok: true };
    // Reachable only in a race, now that /otp/send and /otp/verify answer sign_in first. The old line told the number's own owner it belonged to someone else.
    if ((await res.text()).includes("users_phone_key")) return { ok: false, error: "phone_in_use", message: "This number already has a GoServe account." };
    throw new Error("link failed");
  },
};
// Story #665 (owner, 28 Oct): until an SMS provider is clicked, the code is fixed. With OTP_FIXED_CODE set (six digits), `check` accepts it for any number before the
// database check. `issue` and `sms` are untouched, so the send rules still hold. A wrong code still goes to the database. Risk, said once: anyone can sign in as any
// number while this is set; it is the owner's call for the test phase (the privacy page already says the app is in testing).
export const withFixedCode = (deps: Deps, fixed: string | undefined): Deps =>
  fixed && /^[0-9]{6}$/.test(fixed)
    ? { ...deps, check: (phone, code) => (code === fixed ? Promise.resolve({ ok: true as const, phone: stored(phone) }) : deps.check(phone, code)) }
    : deps;
// The env is read when a code is checked, not at import: the test run has no env permission.
const liveWithFixed: Deps = { ...live, check: (phone, code) => withFixedCode(live, Deno.env.get("OTP_FIXED_CODE")).check(phone, code) };
export const handler = withCors(withRunLog("otp", makeHandler(liveWithFixed), writeRunLog));   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
