// Story #468: one person can own one kitchen and work in another. GET /staff/mine lists the caller's kitchens with their roles; POST /staff and DELETE /staff
// let an admin add or remove ONE membership without touching the others. The caller is read from the bearer token; the admin check and every rule are in the database.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

type Refusal = { ok: false; error: string; message: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  mine: (user: string) => Promise<{ ok: true; kitchens: { kitchen_id: string; name: string; role: string }[] } | Refusal>;
  add: (actor: string, kitchen: string, user: string, role: string) => Promise<{ ok: true } | Refusal>;
  remove: (actor: string, kitchen: string, user: string) => Promise<{ ok: true } | Refusal>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS: Record<string, number> = { not_allowed: 403, kitchen_not_found: 404, user_not_found: 404, membership_not_found: 404 };   // anything else the database refuses is 422
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (r: Refusal) => json(STATUS[r.error] ?? 422, { ok: false, error: r.error, message: r.message });
const bad = () => json(400, { ok: false, error: "invalid_request" });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return new Response(null, { status: 405, headers: { allow: "GET, POST, DELETE" } });
  const tail = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();
  const mine = req.method === "GET" && tail === "mine";
  if (!mine && !(tail === "staff" && req.method !== "GET")) return json(404, { ok: false, error: "not_found" });
  try {
    const caller = await deps.session(req);
    if (!caller) return json(401, { ok: false, error: "unauthorized", message: "Sign in first." });
    if (mine) {
      const r = await deps.mine(caller);
      return r.ok ? json(200, r) : refuse(r);
    }
    let b: any;
    try { b = await req.json(); } catch { return bad(); }
    if (!UUID.test(b?.kitchen_id) || !UUID.test(b?.user_id)) return bad();
    if (req.method === "DELETE") {
      const r = await deps.remove(caller, b.kitchen_id, b.user_id);
      return r.ok ? json(200, { ok: true }) : refuse(r);
    }
    if (typeof b.role !== "string") return bad();
    const r = await deps.add(caller, b.kitchen_id, b.user_id, b.role);
    return r.ok ? json(200, { ok: true }) : refuse(r);
  } catch {
    return json(502, { ok: false, error: "staff_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data sources: the login from the caller's own token; the staff functions with the service key.
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
    mine: (user) => rpc("my_kitchens_v2", { p_user: user }),
    add: (actor, kitchen, user, role) => rpc("staff_add_v2", { p_actor: actor, p_kitchen: kitchen, p_user: user, p_role: role }),
    remove: (actor, kitchen, user) => rpc("staff_remove_v2", { p_actor: actor, p_kitchen: kitchen, p_user: user }),
  };
})();
export const handler = withRunLog("staff", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
