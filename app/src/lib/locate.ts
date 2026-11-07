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

// Story #969: most of small-town India has no postcode on the reverse lookup (volunteers did not tag one). The nearest object that has one, within 10 km, is the fallback.
// Overpass (the same OpenStreetMap data, no key) does not sort by distance, so the nearest is picked here. Any failure or a 4 second wait is "no pin": the field stays empty and says so.
const NEAR_M = 10_000;
const NEAR_WAIT_MS = 4_000;
type Element = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
const metres = (a: Place, b: Place) => {   // a flat-earth distance is plenty at 10 km
  const dy = (a.lat - b.lat) * 111_320, dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
export async function nearestPin(at: Place, state: string | undefined, fetchFn: typeof fetch = fetch): Promise<string> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), NEAR_WAIT_MS);
  try {
    const q = `[out:json][timeout:4];nwr(around:${NEAR_M},${at.lat},${at.lng})["addr:postcode"];out center tags 60;`;
    const res = await fetchFn(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, { signal: stop.signal });
    if (!res.ok) return "";
    const elements: Element[] = (await res.json())?.elements ?? [];
    let best = "", bestAt = Infinity;
    for (const e of elements) {
      const pin = e.tags?.["addr:postcode"]?.replace(/\s/g, "") ?? "";
      const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
      if (!/^\d{6}$/.test(pin) || !pinFits(pin, state) || typeof lat !== "number" || typeof lng !== "number") continue;
      const d = metres(at, { lat, lng });
      if (d < bestAt) { best = pin; bestAt = d; }
    }
    return best;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseAddress(lat: number, lng: number, fetchFn: typeof fetch = fetch): Promise<Found | null> {
  try {
    const res = await fetchFn(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const reply: Reply = await res.json();
    const found = addressFrom(reply);
    if (found && !found.pin) found.pin = await nearestPin({ lat, lng }, reply.address?.state, fetchFn);   // only when the first reply has no fitting pin: one extra call
    return found;
  } catch {
    return null;
  }
}

// The phone's place, once. Rejects when location is not allowed or not found.
export const currentPlace = (): Promise<Place> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  });

// Story #905: the admin stands at the kitchen, so this asks for the best fix and keeps its accuracy in metres.
export type Fix = Place & { accuracy: number | null };
export const currentFix = (): Promise<Fix> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null }), reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });

// Story #910: the drop point follows the address. The fix is kept only while the address is still the one the location found; a hand edit clears it.
export const dropFor = (from: Place | null, located: string | null, address: string): Place | null =>
  from && located !== null && address.trim() === located.trim() ? from : null;
