// Story #1027, source changed by #1029 (owner, 8 Nov 2026: "humara wala pincode wala use kar lete hain"): place search for the Deliver to box. GET /place-search?q=.
// The places come from our own pincodes table (GeoNames place and post-office names) through the SQL function search_places: no third party, no policy to keep, nothing about the caller stored.
// The Nominatim helpers below (makeNominatim, mapHits), the cache table and the one-a-second slot are DORMANT: kept, tested, not called by the handler.
// The data sources are injected so the tests need no network.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";
import { withCors } from "../_shared/cors.ts";
import { serviceability, type KitchenRow } from "../serviceability/serviceability.ts";

export type Hit = { name: string; address: string; lat: number; lng: number; pin: string };
export type Viewbox = [number, number, number, number];   // left (lng), top (lat), right (lng), bottom (lat)
export type Candidate = { pin: string; place: string; state: string | null; lat: number; lng: number };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  allow: (session: string) => boolean;   // 10 calls a minute per caller
  lookup: (q: string) => Promise<Candidate[]>;   // search_places: up to 20 candidates, best first
  served: (lat: number, lng: number) => Promise<boolean>;
};
// Dormant (story #1027): the Nominatim path, below.
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
export const normalise = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

type Raw = { name?: string; display_name?: string; lat?: string; lon?: string; address?: { postcode?: string } };
export function mapHits(reply: unknown): Hit[] {
  if (!Array.isArray(reply)) return [];
  const out: Hit[] = [];
  for (const r of reply as Raw[]) {
    const lat = Number(r.lat), lng = Number(r.lon), address = (r.display_name ?? "").trim();
    if (!address || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const pin = /^\d{6}$/.test(r.address?.postcode ?? "") ? r.address!.postcode! : "";
    out.push({ name: (r.name ?? "").trim() || address.split(",")[0].trim(), address, lat, lng, pin });
    if (out.length === 5) break;
  }
  return out;
}

const PER_MINUTE = 10;
const seen = new Map<string, number[]>();
export const allowCall = (session: string, now = Date.now()): boolean => {   // per instance and best effort; the database slot is the hard stop
  const recent = (seen.get(session) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) { seen.set(session, recent); return false; }
  seen.set(session, [...recent, now]);
  return true;
};

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  const q = normalise(new URL(req.url).searchParams.get("q") ?? "");
  if (q.length < 3 || q.length > 100) return json(400, { ok: false, error: "invalid_query" });
  try {
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized" });
    if (!deps.allow(session)) return json(429, { ok: false, error: "slow_down" });
    const found = await deps.lookup(q);
    const flagged = await Promise.all(found.map(async (c) => ({ c, served: await deps.served(c.lat, c.lng) })));
    const results = [...flagged.filter((f) => f.served), ...flagged.filter((f) => !f.served)].slice(0, 5).map(({ c, served }) => ({
      name: c.place, address: [c.place, c.state, c.pin].filter(Boolean).join(", "), lat: c.lat, lng: c.lng, pin: c.pin, served,
    }));
    return json(200, { ok: true, results });
  } catch {
    return json(502, { ok: false, error: "search_unavailable" });   // no detail: a database message must never reach an app
  }
};

export const makeNominatim = (fetchFn: typeof fetch = fetch) => async (q: string, viewbox: Viewbox | null): Promise<unknown> => {
  const p = new URLSearchParams({ q, format: "jsonv2", countrycodes: "in", limit: "5", addressdetails: "1", bounded: "0" });
  if (viewbox) p.set("viewbox", viewbox.join(","));
  const res = await fetchFn(`https://nominatim.openstreetmap.org/search?${p}`, { headers: { "user-agent": "GoServe/1.0 (+https://goserve-app.pages.dev)", "accept-language": "en" } });
  if (!res.ok) throw new Error("search");
  return await res.json();
};

const url = () => Deno.env.get("SUPABASE_URL")!;
const service = () => { const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; return { apikey: k, authorization: `Bearer ${k}`, "content-type": "application/json" }; };
let kitchens: { at: number; rows: KitchenRow[] } | undefined;
const kitchenRows = async (): Promise<KitchenRow[]> => {   // a minute of memory: the box is typed into, kitchens do not move that fast
  if (kitchens && Date.now() - kitchens.at < 60_000) return kitchens.rows;
  const res = await fetch(`${url()}/rest/v1/kitchens?select=id,name,lat,lng,radius_m,prep_minutes,open,active,opens_at,closes_at&active=eq.true`, { headers: service() });
  if (!res.ok) throw new Error("kitchens");
  kitchens = { at: Date.now(), rows: await res.json() };
  return kitchens.rows;
};
const live: Deps = {
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  allow: allowCall,
  lookup: async (q) => {
    const res = await fetch(`${url()}/rest/v1/rpc/search_places`, { method: "POST", headers: service(), body: JSON.stringify({ p_q: q }) });
    if (!res.ok) throw new Error("search_places");
    return await res.json();
  },
  served: async (lat, lng) => serviceability({ lat, lng }, await kitchenRows(), new Date()).serviceable,
};
export const handler = withCors(withRunLog("place-search", makeHandler(live), writeRunLog));

if (import.meta.main) Deno.serve(handler);
