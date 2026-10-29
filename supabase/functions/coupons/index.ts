// Story #346: GET /coupons. The coupons valid now (active, inside their dates, under their max uses). The database decides; this only lists.
// Which one is best for a cart is the quote's job (POST /quote returns `offers`). The service key reads, because the coupon functions are not public.
import type { Coupon } from "../quote/quote.ts";
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

export type Deps = { list: () => Promise<Coupon[]> };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  try {
    return json(200, { ok: true, coupons: await deps.list() });
  } catch {
    return json(502, { ok: false, error: "coupons_unavailable" });   // no detail: a database message must never reach an app
  }
};

const live: Deps = {
  list: async () => {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")!}/rest/v1/rpc/coupons_valid_v2`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}" });
    if (!res.ok) throw new Error("rpc failed");
    return await res.json();
  },
};
export const handler = withRunLog("coupons", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
