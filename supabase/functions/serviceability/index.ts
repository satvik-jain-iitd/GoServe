// Story #342: GET /serviceability?lat=&lng=. Which kitchens can deliver to this place, how soon, and whether each is open.
// Out of range: serviceable false and request_here true (the app offers 'Request here', which saves a row in `waitlist`).
// The data source is injected so the tests need no network; the real one reads kitchens with the project's anon key (kitchens are public to read).
import { serviceability, type KitchenRow } from "./serviceability.ts";

export type Deps = { kitchens: () => Promise<KitchenRow[]>; now: () => Date };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const num = (s: string | null, max: number) => {
  const n = s === null || s.trim() === "" ? NaN : Number(s);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  const q = new URL(req.url).searchParams;
  const lat = num(q.get("lat"), 90), lng = num(q.get("lng"), 180);
  if (lat === null || lng === null) return json(400, { ok: false, error: "invalid_place" });
  try {
    return json(200, serviceability({ lat, lng }, await deps.kitchens(), deps.now()));
  } catch {
    return json(502, { ok: false, error: "serviceability_unavailable" });   // no detail: a database message must never reach an app
  }
};

const COLUMNS = "id,name,lat,lng,radius_m,prep_minutes,open,active,opens_at,closes_at";
const live: Deps = {
  now: () => new Date(),
  kitchens: async () => {
    const key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/kitchens?select=${COLUMNS}&active=eq.true`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error("kitchens read failed");
    return await res.json();
  },
};
export const handler = makeHandler(live);

if (import.meta.main) Deno.serve(handler);
