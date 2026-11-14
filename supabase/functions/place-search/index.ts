// Story 1519 (owner, 14 Nov 2026: "we should rely on trusted data from ola maps", "our own data should become backup"): place search for the pin map and the Deliver to box.
// GET /place-search?q=&lat=&lng=. The places come from Ola Maps autocomplete, near the map first: one ask inside the near radius (radius + strictbounds), and one wide ask
// when that gives fewer than 3. Our own pincodes table (search_places, stories #1027 and #1029) is the backup: it answers when Ola fails, is slow or a daily cap is reached,
// and it fills a list of fewer than 3. The customer never sees an error for any of these.
// Ola's terms (as in geocode/index.ts): an answer is shown to the customer and is never stored in a table of ours, never cached by place, never sent to a model.
// The log holds no typed text, no place text and no coordinates.
// The Nominatim helpers below (makeNominatim, mapHits), the cache table and the one-a-second slot are DORMANT: kept, tested, not called by the handler.
// The data sources are injected so the tests need no network.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";
import { withCors } from "../_shared/cors.ts";
import { olaToken } from "../_shared/ola.ts";
import { serviceability, type KitchenRow } from "../serviceability/serviceability.ts";

export type Hit = { name: string; address: string; lat: number; lng: number; pin: string };
export type Viewbox = [number, number, number, number];   // left (lng), top (lat), right (lng), bottom (lat)
export type Candidate = { pin: string; place: string; state: string | null; lat: number; lng: number };
export type At = { lat: number; lng: number };
export type Place = { id: string; name: string; address: string; lat: number; lng: number; pin: string };   // one Ola place: the name, the area and city line, its own point
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  allow: (session: string) => boolean;   // 30 calls a minute per caller
  cap: (session: string) => Promise<"ok" | "person" | "app">;   // story 1519: today's count of Ola asks for this person and for the whole app; "ok" adds one to both
  radius: () => Promise<number>;   // the near radius in metres, a settings row
  ola: (q: string, at: At | null, radius: number | null) => Promise<Place[]>;   // one Ola autocomplete ask; with a radius only places inside it
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

// Ola autocomplete: predictions with structured_formatting (main_text, secondary_text), geometry.location and place_id. The point comes with the place.
type Prediction = { place_id?: string; structured_formatting?: { main_text?: string; secondary_text?: string }; geometry?: { location?: { lat?: number; lng?: number } } };
export function mapPlaces(reply: unknown): Place[] {
  const list = (reply as { predictions?: Prediction[] } | null)?.predictions;
  if (!Array.isArray(list)) return [];
  const out: Place[] = [];
  for (const p of list) {
    const name = (p.structured_formatting?.main_text ?? "").trim(), address = (p.structured_formatting?.secondary_text ?? "").trim();
    const lat = p.geometry?.location?.lat, lng = p.geometry?.location?.lng;
    if (!name || typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    out.push({ id: p.place_id || `${name}|${lat}|${lng}`, name, address: address || name, lat, lng, pin: address.match(/\b\d{6}\b/)?.[0] ?? "" });
  }
  return out;
}

const OLA_MS = 3_000;   // story 1519: Ola slower than this counts as no answer; our own table answers
const NEAR_ENOUGH = 3, ROWS = 5;
const PER_MINUTE = 30;   // story 1519: the box asks while the person types (one ask for each pause)
const seen = new Map<string, number[]>();
export const allowCall = (session: string, now = Date.now()): boolean => {   // per instance and best effort; the database slot is the hard stop
  const recent = (seen.get(session) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) { seen.set(session, recent); return false; }
  seen.set(session, [...recent, now]);
  return true;
};

const coord = (s: string | null, max: number) => { const n = s === null || s.trim() === "" ? NaN : Number(s); return Number.isFinite(n) && Math.abs(n) <= max ? n : null; };

export const makeHandler = (deps: Deps, olaMs = OLA_MS) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  const params = new URL(req.url).searchParams;
  const q = normalise(params.get("q") ?? "");
  if (q.length < 3 || q.length > 100) return json(400, { ok: false, error: "invalid_query" });
  const lat = coord(params.get("lat"), 90), lng = coord(params.get("lng"), 180);
  const at: At | null = lat !== null && lng !== null ? { lat, lng } : null;   // the place the map is on; without it only the wide ask is made
  try {
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized" });
    if (!deps.allow(session)) return json(429, { ok: false, error: "slow_down" });
    // Ola first. Any failure, a slow answer or a reached cap leaves an empty list here, and our own table answers below with no error.
    const ask = async (radius: number | null): Promise<Place[] | null> => {   // null: a cap is reached, Ola is not asked
      const cap = await deps.cap(session);
      if (cap === "app") console.log("place-search: the whole-app daily cap is reached");   // no typed text, no place and no person in the log
      return cap === "ok" ? await deps.ola(q, at, radius) : null;
    };
    const fromOla = async (): Promise<Place[]> => {
      const near = at ? await ask(await deps.radius()) : [];
      if (near === null) return [];
      if (near.length >= NEAR_ENOUGH) return near;
      const wide = (await ask(null)) ?? [];
      return [...near, ...wide.filter((w) => !near.some((n) => n.id === w.id))];   // near places first, then the far ones, none twice; Ola's own order inside each group
    };
    const places = (await Promise.race([fromOla(), new Promise<Place[]>((ok) => setTimeout(() => ok([]), olaMs))]).catch(() => [])).slice(0, ROWS);
    const rows: { name: string; address: string; lat: number; lng: number; pin: string; from: "ola" | "own" }[] = places.map(({ name, address, lat, lng, pin }) => ({ name, address, lat, lng, pin, from: "ola" }));
    let own: typeof rows = [];
    if (rows.length < NEAR_ENOUGH) {   // the backup, and the fill for a short list
      const found = await deps.lookup(q).catch((e) => { if (rows.length === 0) throw e; return []; });
      own = found.filter((c) => !rows.some((r) => r.name.toLowerCase() === c.place.toLowerCase()))
        .map((c) => ({ name: c.place, address: [c.place, c.state, c.pin].filter(Boolean).join(", "), lat: c.lat, lng: c.lng, pin: c.pin, from: "own" as const }));
    }
    const flag = async (list: typeof rows) => await Promise.all(list.map(async (r) => ({ ...r, served: await deps.served(r.lat, r.lng) })));
    const [olaRows, ownRows] = [await flag(rows), await flag(own)];
    // Ola's order is kept as it is. Our own rows keep their old rule: served places first, then the table's own order.
    const results = [...olaRows, ...ownRows.filter((f) => f.served), ...ownRows.filter((f) => !f.served)].slice(0, ROWS)
      .map(({ name, address, lat, lng, pin, served, from }) => ({ name, address, lat, lng, pin, served, from }));
    return json(200, { ok: true, from: olaRows.length ? "ola" : "own", results });   // "ola" tells the app to show the Ola Maps credit
  } catch {
    return json(502, { ok: false, error: "search_unavailable" });   // no detail: a database or vendor message must never reach an app
  }
};

// One Ola autocomplete ask. Near: location + radius + strictbounds (a common word like "bus stand" otherwise lands 700 km away). Wide: location only, as a bias.
export const makeOlaSearch = (o: { id: string; secret: string; fetchFn?: typeof fetch; now?: () => number }) => {
  const fetchFn = o.fetchFn ?? fetch, fresh = olaToken(o);
  return async (q: string, at: At | null, radius: number | null): Promise<Place[]> => {
    const p = new URLSearchParams({ input: q });
    if (at) p.set("location", `${at.lat},${at.lng}`);
    if (at && radius !== null) { p.set("radius", String(radius)); p.set("strictbounds", "true"); }
    const res = await fetchFn(`https://api.olamaps.io/places/v1/autocomplete?${p}`, { headers: { authorization: `Bearer ${await fresh()}`, "x-request-id": crypto.randomUUID() } });
    if (!res.ok) throw new Error("autocomplete");
    return mapPlaces(await res.json());
  };
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
const NEAR_M = 25_000;
let olaSearch: ReturnType<typeof makeOlaSearch> | undefined;
const live: Deps = {
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  allow: allowCall,
  cap: async (session) => {   // one atomic SQL function counts and decides; the two caps are settings rows (0 stops Ola). A failure throws, so no count means no Ola ask.
    const res = await fetch(`${url()}/rest/v1/rpc/place_search_count`, { method: "POST", headers: service(), body: JSON.stringify({ p_person: session }) });
    if (!res.ok) throw new Error("cap");
    return await res.json();
  },
  radius: async () => {
    try {
      const rows = await (await fetch(`${url()}/rest/v1/settings?select=value&name=eq.place_search_radius_m&limit=1`, { headers: service() })).json();
      return rows.length && typeof rows[0].value === "number" ? rows[0].value : NEAR_M;
    } catch { return NEAR_M; }
  },
  ola: (q, at, radius) => (olaSearch ??= makeOlaSearch({ id: Deno.env.get("OLA_MAPS_CLIENT_ID") ?? "", secret: Deno.env.get("OLA_MAPS_CLIENT_SECRET") ?? "" }))(q, at, radius),   // one token cache for the life of the instance
  lookup: async (q) => {
    const res = await fetch(`${url()}/rest/v1/rpc/search_places`, { method: "POST", headers: service(), body: JSON.stringify({ p_q: q }) });
    if (!res.ok) throw new Error("search_places");
    return await res.json();
  },
  served: async (lat, lng) => serviceability({ lat, lng }, await kitchenRows(), new Date()).serviceable,
};
export const handler = withCors(withRunLog("place-search", makeHandler(live), writeRunLog));

if (import.meta.main) Deno.serve(handler);
