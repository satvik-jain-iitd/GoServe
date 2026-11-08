// Story #1027: forward place search for the Deliver to box. GET /place-search?q=. OpenStreetMap Nominatim behind our own function, so the rules of that public server live in one place.
// Its policy (operations.osmfoundation.org/policies/nominatim, read 8 Nov 2026): 1 request a second in total, an identifying User-Agent, results cached on our side, attribution shown, and
// NO auto-complete: the screen searches on submit, never on each keystroke. A cached answer makes no call at all. The caller is never stored with a query.
// The data sources are injected so the tests need no network.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";
import { withCors } from "../_shared/cors.ts";
import { serviceability, type KitchenRow } from "../serviceability/serviceability.ts";

export type Hit = { name: string; address: string; lat: number; lng: number; pin: string };
export type Viewbox = [number, number, number, number];   // left (lng), top (lat), right (lng), bottom (lat)
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  allow: (session: string) => boolean;   // 10 calls a minute per caller
  cached: (key: string) => Promise<Hit[] | null>;   // an answer under 30 days old
  save: (key: string, hits: Hit[]) => Promise<void>;
  slot: () => Promise<boolean>;   // the one-a-second slot, kept in the database so every instance shares it
  viewbox: () => Promise<Viewbox | null>;
  search: (q: string, viewbox: Viewbox | null) => Promise<unknown>;
  served: (lat: number, lng: number) => Promise<boolean>;
};
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
    let hits = await deps.cached(q);
    if (!hits) {
      if (!(await deps.slot())) return json(429, { ok: false, error: "slow_down" });
      hits = mapHits(await deps.search(q, await deps.viewbox()));
      await deps.save(q, hits);
    }
    const results = await Promise.all(hits.map(async (h) => ({ ...h, served: await deps.served(h.lat, h.lng) })));
    return json(200, { ok: true, results });
  } catch {
    return json(502, { ok: false, error: "search_unavailable" });   // no detail: a vendor message must never reach an app
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
const THIRTY_DAYS = 30 * 86_400_000;
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
  cached: async (key) => {
    const since = new Date(Date.now() - THIRTY_DAYS).toISOString();
    const res = await fetch(`${url()}/rest/v1/place_search_cache?select=results&key=eq.${encodeURIComponent(key)}&created_at=gte.${since}&limit=1`, { headers: service() });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length ? rows[0].results : null;
  },
  save: async (key, hits) => {
    await fetch(`${url()}/rest/v1/place_search_cache?on_conflict=key`, { method: "POST", headers: { ...service(), prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, results: hits, created_at: new Date().toISOString() }) });
  },
  slot: async () => {
    const res = await fetch(`${url()}/rest/v1/rpc/place_search_take_slot`, { method: "POST", headers: service(), body: "{}" });
    return res.ok && (await res.json()) === true;
  },
  viewbox: async () => {   // our kitchens and 0.3 degrees around them (about 30 km): the city the customer is in
    const rows = (await kitchenRows()).filter((k) => k.lat != null && k.lng != null);
    if (rows.length === 0) return null;
    const lats = rows.map((k) => k.lat!), lngs = rows.map((k) => k.lng!);
    return [Math.min(...lngs) - 0.3, Math.max(...lats) + 0.3, Math.max(...lngs) + 0.3, Math.min(...lats) - 0.3];
  },
  search: makeNominatim(),
  served: async (lat, lng) => serviceability({ lat, lng }, await kitchenRows(), new Date()).serviceable,
};
export const handler = withCors(withRunLog("place-search", makeHandler(live), writeRunLog));

if (import.meta.main) Deno.serve(handler);
