// Story #340: GET /me, PATCH /me and DELETE /me. The caller's own name and email, and the soft delete of the account.
// The caller is read from the bearer token; nobody can name another user. The rules (a good name, a real email, a deleted account) are in the database.
// DELETE hides the profile and stops the pings at once; the purge job (purge_deleted_accounts_v2, run later) removes the personal rows and the login.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

type Refusal = { ok: false; error: string; message: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  get: (user: string) => Promise<{ ok: true; profile: { name: string | null; email: string | null } } | Refusal>;
  set: (user: string, name: string | null, email: string | null) => Promise<{ ok: true } | Refusal>;   // null = not sent, "" = clear
  remove: (user: string) => Promise<{ ok: true } | Refusal>;
};
const STATUS: Record<string, number> = { account_deleted: 410 };   // anything else the database refuses is 422
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (r: Refusal) => json(STATUS[r.error] ?? 422, { ok: false, error: r.error, message: r.message });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (!["GET", "PATCH", "DELETE"].includes(req.method)) return new Response(null, { status: 405, headers: { allow: "GET, PATCH, DELETE" } });
  try {
    const user = await deps.session(req);
    if (!user) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
    if (req.method === "GET") {
      const r = await deps.get(user);
      return r.ok ? json(200, r) : refuse(r);
    }
    if (req.method === "DELETE") {
      const r = await deps.remove(user);
      return r.ok ? json(200, { ok: true }) : refuse(r);
    }
    let b: any;
    try { b = await req.json(); } catch { return json(400, { ok: false, error: "invalid_request" }); }
    const name = b?.name ?? null, email = b?.email ?? null;
    if (!b || typeof b !== "object" || Array.isArray(b) || (name === null && email === null) || (name !== null && typeof name !== "string") || (email !== null && typeof email !== "string")) return json(400, { ok: false, error: "invalid_request" });
    const r = await deps.set(user, name, email);
    return r.ok ? json(200, { ok: true }) : refuse(r);
  } catch {
    return json(502, { ok: false, error: "me_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data sources: the login from the caller's own token; the profile functions with the service key.
const live: Deps = (() => {
  const url = () => Deno.env.get("SUPABASE_URL")!;
  const service = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rpc = async (fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`${url()}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: service(), authorization: `Bearer ${service()}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("rpc failed");
    return await res.json();
  };
  return {
    session: async (req) => {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
      if (!token) return null;
      const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
      return res.ok ? ((await res.json()).id ?? null) : null;
    },
    get: (user) => rpc("profile_get_v2", { p_user: user }),
    set: (user, name, email) => rpc("profile_set_v2", { p_user: user, p_name: name, p_email: email }),
    remove: (user) => rpc("account_delete_v2", { p_user: user }),
  };
})();
export const handler = withRunLog("me", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
