// Story #342: can a kitchen deliver to this place, and how soon. Pure: a place + the kitchen rows + the clock in, an answer out.
// Distance is the straight line (haversine). Road distance is later; the radius is set per kitchen with that in mind.
export type Place = { lat: number; lng: number };
export type KitchenRow = {
  id: string; name: string; lat: number | null; lng: number | null; radius_m: number; prep_minutes: number;
  open: boolean; active: boolean; opens_at: string | null; closes_at: string | null;   // opens_at / closes_at: "HH:MM:SS" in Delhi time
};
export type Served = { kitchen_id: string; name: string; distance_m: number; eta_min: number; open: boolean };
export type Answer = { ok: true; serviceable: boolean; request_here: boolean; kitchens: Served[] };

export const RIDER_M_PER_MIN = 250;   // 15 km/h: an assumption (docs/assumptions.md), tuned from real rides later
const EARTH_M = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: Place, b: Place): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// Delhi has no daylight saving: a fixed +05:30 offset is exact.
export function isOpenAt(opens: string | null, closes: string | null, now: Date): boolean {
  if (!opens || !closes) return true;
  const ist = new Date(now.getTime() + 330 * 60_000);
  const m = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const [o, c] = [minutes(opens), minutes(closes)];
  return o < c ? m >= o && m < c : m >= o || m < c;
}

export function serviceability(place: Place, kitchens: KitchenRow[], now: Date): Answer {
  const served: Served[] = [];
  for (const k of kitchens) {
    if (!k.active || k.lat == null || k.lng == null) continue;
    const d = distanceM(place, { lat: k.lat, lng: k.lng });
    if (d > k.radius_m) continue;
    served.push({ kitchen_id: k.id, name: k.name, distance_m: Math.round(d), eta_min: k.prep_minutes + Math.ceil(d / RIDER_M_PER_MIN), open: k.open && isOpenAt(k.opens_at, k.closes_at, now) });
  }
  served.sort((a, b) => a.distance_m - b.distance_m);
  return { ok: true, serviceable: served.length > 0, request_here: served.length === 0, kitchens: served };
}
