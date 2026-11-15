// Story #668 (boards A1 to A3): the customer's own address from the phone's location. The browser gives the place; OpenStreetMap's reverse lookup (Nominatim, no key) gives the address.
// One call per customer, only after they allow location. Any failure is "type it by hand". Public server rules (1 call a second, our page as the referrer) are met by one call.
// Later, for many customers: a small proxy with a cache (the policy asks for it).
export type Place = { lat: number; lng: number };
export type Found = { address: string; pin: string };

type Reply = { address?: Record<string, string> };

// The first two or three digits of an Indian pin name its state. Only the states we serve and their neighbours; a state not in the table keeps its pin.
// Story 827: OpenStreetMap postcodes are typed by volunteers and some are wrong (a Gurgaon object tagged 110058, a Delhi pin). A pin that disagrees with the
// state in the same reply is not better than no pin: the customer types it.
const PIN_PREFIXES: Record<string, string[]> = {
  delhi: ["110"], haryana: ["12", "13"], punjab: ["14", "15", "16"], rajasthan: ["30", "31", "32", "33", "34"],
  "uttar pradesh": ["20", "21", "22", "23", "24", "25", "26", "27", "28"],
};
const pinFits = (pin: string, state: string | undefined) => {
  const prefixes = PIN_PREFIXES[(state ?? "").trim().toLowerCase()];
  return !prefixes || prefixes.some((p) => pin.startsWith(p));
};

// "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi, Delhi": the street parts, the city and the state, so the customer can see what the app thinks. Never the country.
export function addressFrom(r: Reply): Found | null {
  const a = r.address;
  if (!a) return null;
  const street = [a.house_number, a.road, a.neighbourhood ?? a.suburb, a.city ?? a.town ?? a.village ?? a.state_district].filter(Boolean);
  if (street.length === 0) return null;
  if (a.state && street[street.length - 1] !== a.state) street.push(a.state);
  const pin = /^\d{6}$/.test(a.postcode ?? "") && pinFits(a.postcode, a.state) ? a.postcode : "";
  return { address: street.join(", "), pin };
}

// Story #987 (was #969): most of small-town India has no postcode on the reverse lookup (volunteers did not tag one). The fallback is our own table of GeoNames
// centroids, one call to the Supabase rpc `nearest_pin` (closest within 15 km, indexed). No third party, no key beyond the public one. Any failure or a 4 second wait
// is "no pin": the field stays empty and says so. The state check (story 827) still applies to the answer.
const NEAR_WAIT_MS = 4_000;
type PinDeps = { fetchFn: typeof fetch; url: string; anon: string; token: () => Promise<string> };
export async function nearestPin(at: Place, state: string | undefined, deps?: PinDeps): Promise<string> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), NEAR_WAIT_MS);
  try {
    const d = deps ?? (await import("./ordersV2")).v2Deps();
    const res = await d.fetchFn(`${d.url}/rest/v1/rpc/nearest_pin`, {
      method: "POST", signal: stop.signal,
      headers: { apikey: d.anon, authorization: `Bearer ${await d.token()}`, "content-type": "application/json" },
      body: JSON.stringify({ p_lat: at.lat, p_lng: at.lng }),
    });
    if (!res.ok) return "";
    const pin = await res.json();
    return typeof pin === "string" && /^\d{6}$/.test(pin) && pinFits(pin, state) ? pin : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseAddress(lat: number, lng: number, fetchFn: typeof fetch = fetch, pinDeps?: PinDeps): Promise<Found | null> {
  try {
    const res = await fetchFn(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const reply: Reply = await res.json();
    const found = addressFrom(reply);
    if (found && !found.pin) found.pin = await nearestPin({ lat, lng }, reply.address?.state, pinDeps);   // only when the first reply has no fitting pin: one call to our own table
    return found;
  } catch {
    return null;
  }
}

// The phone's place, once. Rejects when location is not allowed or not found.
// Story 1548: the fix also says how rough it is (accuracy, metres) and how fast the phone moves (speed, metres a second); null when the phone does not say.
export type Phone = Place & { accuracy: number | null; speed: number | null };
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const currentPlace = (): Promise<Phone> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: num(p.coords.accuracy), speed: num(p.coords.speed) }), reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  });

// Bug 1526: every failure was called "blocked". The browser's error code says which it is: 1 blocked for this app, 2 the phone's location is off or gives no fix, 3 too slow.
// "ask": the phone was never asked (no permission yet), so nothing failed. "still": blocked, tapped again and blocked again, so the second tap says something new.
export type LocWhy = "ask" | "denied" | "still" | "off" | "slow" | "none";   // none (story 1530): an error with no code; the line claims no cause
const WORDS: Record<LocWhy, [string, string]> = {
  ask: ["We can't see where you are right now", "Tap Use current location"],
  denied: ["Location is off or blocked", "Turn on location in your phone settings"],
  still: ["Still off or blocked", "Turn on location in your phone's settings"],
  off: ["Your phone's location is off", "Turn it on"],
  slow: ["Finding you is taking too long", "Try again"],
  none: ["We could not find where you are", "Try again"],
};
export const locWhy = (e: unknown, before?: LocWhy | null): LocWhy => {
  const code = (e as { code?: unknown } | null)?.code;
  return code === 1 ? (before === "denied" || before === "still" ? "still" : "denied") : code === 3 ? "slow" : code === 2 ? "off" : "none";
};
/** The true words for a cause: the fact, and the way out. `out` is the other way this screen offers ("search above"). */
export const locWords = (why: LocWhy, out: string): { title: string; sub: string } => ({ title: WORDS[why][0], sub: `${WORDS[why][1]}, or ${out}.` });   // the way out is the screen's own: "pick a place" only where there is a list
export const locLine = (why: LocWhy, out: string): string => { const w = locWords(why, out); return `${w.title}. ${w.sub}`; };

// Stories 1529 and 1526: the phone's place, or why not. By itself (no tap) the app never makes the browser ask: it uses only a permission given before, and waits waitMs.
// A browser with no permissions.query (an older iPhone) is treated as never asked. A tap always asks.
export async function findPhone(tap: boolean, before: LocWhy | null = null, waitMs = 5000): Promise<Phone | LocWhy> {
  if (!tap) {
    let state: string | undefined;
    try { state = (await navigator.permissions?.query({ name: "geolocation" as PermissionName }))?.state; } catch { /* never asked */ }
    if (state !== "granted") return state === "denied" ? "denied" : "ask";
  }
  try {
    return await (tap ? currentPlace() : Promise.race([currentPlace(), new Promise<never>((_, no) => setTimeout(() => no({ code: 3 }), waitMs))]));
  } catch (e) {
    return locWhy(e, before);
  }
}

// Story #905: the admin stands at the kitchen, so this asks for the best fix and keeps its accuracy in metres.
export type Fix = Place & { accuracy: number | null };
export const currentFix = (): Promise<Fix> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null }), reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });

// Story #998: the address words and the pin from Ola Maps, asked through our own function (the browser never holds a key); when it says no for any reason, OpenStreetMap answers as before.
// Ola's answer is shown to the customer and kept only on their own address. It is never stored by place or in a table of ours (Ola's terms).
export type Looked = Found & { from: "ola" | "osm" };
type LookupDeps = { fetchFn: typeof fetch; url: string; anon: string; token: () => Promise<string> };
export async function findAddress(lat: number, lng: number, deps?: LookupDeps): Promise<Looked | null> {
  try {
    const d = deps ?? (await import("./ordersV2")).v2Deps();
    const res = await d.fetchFn(`${d.url}/functions/v1/geocode?lat=${lat}&lng=${lng}`, { headers: { apikey: d.anon, authorization: `Bearer ${await d.token()}` } });
    if (res.ok) {
      const a = await res.json();
      if (a?.ok && typeof a.address === "string" && a.address.trim()) return { address: a.address, pin: /^\d{6}$/.test(a.pin ?? "") ? a.pin : "", from: "ola" };
    }
  } catch { /* off, over the cap, no connection: OpenStreetMap answers */ }
  const osm = await reverseAddress(lat, lng, deps?.fetchFn, deps);
  return osm ? { ...osm, from: "osm" } : null;
}
