// Story #998: the customer's address words and pin code from Ola Maps reverse geocode (owner's pick, 8 Nov 2026). GET /geocode?lat=&lng=.
// The key never reaches a browser: this function holds the OAuth client credentials (secrets OLA_MAPS_CLIENT_ID and OLA_MAPS_CLIENT_SECRET) and asks Ola for one place at the moment of need.
// Ola's terms (clauses 6.a.X, XIV, XVI, XV): an answer is shown to the customer and kept only on that customer's own order or address. It is never stored in a table of ours, never cached by place, never sent to a model.
// The data sources are injected so the tests need no network.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";
import { withCors } from "../_shared/cors.ts";
import { olaToken } from "../_shared/ola.ts";

export type Found = { address: string; pin: string; locality: string; town: string };
export type Deps = {
  session: (req: Request) => Promise<string | null>;
  provider: () => Promise<string>;   // the settings row lookup_provider: "ola" (default) or "osm" (the old OpenStreetMap path stays in the app)
  allow: (session: string) => boolean;   // 10 calls a minute per caller
  cap: (session: string) => Promise<"ok" | "person" | "app">;   // story 1512: today's count for this person and for the whole app; "ok" adds one to both
  budget: () => Promise<boolean>;   // false when this month's free calls are used up
  lookup: (lat: number, lng: number) => Promise<unknown>;
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const num = (s: string | null, max: number) => {
  const n = s === null || s.trim() === "" ? NaN : Number(s);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

type Component = { types?: string[]; long_name?: string };
export function mapReply(reply: unknown): Found | null {
  const r = (reply as { results?: { address_components?: Component[] }[] } | null)?.results?.[0];
  const parts = r?.address_components;
  if (!parts || parts.length === 0) return null;
  const of = (...types: string[]) => { for (const t of types) { const c = parts.find((p) => p.types?.includes(t)); if (c?.long_name) return c.long_name; } return ""; };
  const postal = of("postal_code");
  const locality = of("sublocality", "neighborhood");
  const town = of("locality", "administrative_area_level_3");
  const state = of("administrative_area_level_1");
  const words = [locality, town, state].filter((w, i, all) => w && all.indexOf(w) === i);
  if (words.length === 0) return null;
  return { address: words.join(", "), pin: /^\d{6}$/.test(postal) ? postal : "", locality, town };
}

const PER_MINUTE = 10;
const seen = new Map<string, number[]>();
export const allowCall = (session: string, now = Date.now()): boolean => {   // per instance and best effort; the monthly counter is the hard stop
  const recent = (seen.get(session) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) { seen.set(session, recent); return false; }
  seen.set(session, [...recent, now]);
  return true;
};

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  const q = new URL(req.url).searchParams;
  const lat = num(q.get("lat"), 90), lng = num(q.get("lng"), 180);
  if (lat === null || lng === null) return json(400, { ok: false, error: "invalid_place" });
  try {
    const session = await deps.session(req);
    if (!session) return json(401, { ok: false, error: "unauthorized" });
    if ((await deps.provider()) !== "ola") return json(503, { ok: false, error: "provider_off" });
    if (!deps.allow(session)) return json(429, { ok: false, error: "slow_down" });
    const cap = await deps.cap(session);   // story 1512: over a daily cap Ola is not asked; the app falls back to OpenStreetMap and shows no error
    if (cap === "person") return json(429, { ok: false, error: "over_cap" });
    if (cap === "app") { console.log("geocode: the whole-app daily cap is reached"); return json(503, { ok: false, error: "over_cap" }); }   // no place and no person in the log
    if (!(await deps.budget())) return json(503, { ok: false, error: "over_cap" });
    const found = mapReply(await deps.lookup(lat, lng));
    return found ? json(200, { ok: true, ...found }) : json(404, { ok: false, error: "not_found" });
  } catch {
    return json(502, { ok: false, error: "geocode_unavailable" });   // no detail: a vendor message or a key must never reach an app
  }
};

// One token serves many lookups until its last minute (_shared/ola.ts, shared with place-search since story 1519).
export const makeOla = (o: { id: string; secret: string; fetchFn?: typeof fetch; now?: () => number }) => {
  const fetchFn = o.fetchFn ?? fetch, fresh = olaToken(o);
  return async (lat: number, lng: number): Promise<unknown> => {
    const res = await fetchFn(`https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}`, { headers: { authorization: `Bearer ${await fresh()}`, "x-request-id": crypto.randomUUID() } });
    if (!res.ok) throw new Error("reverse");
    return await res.json();
  };
};

const url = () => Deno.env.get("SUPABASE_URL")!;
const service = () => { const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; return { apikey: k, authorization: `Bearer ${k}`, "content-type": "application/json" }; };
const FREE_CALLS = 100_000;   // Ola's free calls per month for this API (pricing page, 8 Nov 2026)
let ola: ReturnType<typeof makeOla> | undefined;
const live: Deps = {
  session: async (req) => {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  provider: async () => {
    try {
      const rows = await (await fetch(`${url()}/rest/v1/settings?select=value&name=eq.lookup_provider&limit=1`, { headers: service() })).json();
      return rows.length && typeof rows[0].value === "string" ? rows[0].value : "ola";
    } catch { return "ola"; }
  },
  allow: allowCall,
  cap: async (session) => {   // one atomic SQL function counts and decides; the two caps are settings rows. A failure throws, so no count means no Ola call.
    const res = await fetch(`${url()}/rest/v1/rpc/geocode_count`, { method: "POST", headers: service(), body: JSON.stringify({ p_person: session }) });
    if (!res.ok) throw new Error("cap");
    return await res.json();
  },
  budget: async () => {   // one settings row holds the month and its count; a new month starts at zero. Two calls at once can pass the last slot by one; the cap leaves room.
    const month = new Date().toISOString().slice(0, 7);
    const rows = await (await fetch(`${url()}/rest/v1/settings?select=value&name=eq.ola_calls&limit=1`, { headers: service() })).json();
    const used = rows.length && rows[0].value?.month === month ? Number(rows[0].value.count) || 0 : 0;
    if (used >= FREE_CALLS) return false;
    await fetch(`${url()}/rest/v1/settings?on_conflict=name`, { method: "POST", headers: { ...service(), prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ name: "ola_calls", value: { month, count: used + 1 } }) });
    return true;
  },
  lookup: (lat, lng) => (ola ??= makeOla({ id: Deno.env.get("OLA_MAPS_CLIENT_ID") ?? "", secret: Deno.env.get("OLA_MAPS_CLIENT_SECRET") ?? "" }))(lat, lng),   // one token cache for the life of the instance
};
export const handler = withCors(withRunLog("geocode", makeHandler(live), writeRunLog));

if (import.meta.main) Deno.serve(handler);
