// Story 1548: what this phone remembers of the box "Where should we deliver?". A spot where the customer answered "Use another address" is not asked about again
// the same local day. The list lives only on this phone (20 spots at most); a second phone asks once by itself. Nothing here is sent anywhere or logged.
import { distanceM, type Place } from "./addresses";

export type Spot = { lat: number; lng: number; day: string; at: number; moving: boolean };
const KEY = "gs-asked-spots";
export const SPOTS_MAX = 20;
export const ROUGH_M = 1000;   // a fix rougher than this raises no box
export const MOVING_MPS = 5;   // 18 km an hour: faster than a walk
export const MOVING_MS = 3 * 3600_000;

export const dayOf = (now: Date): string => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;   // the local calendar day
const isSpot = (s: Spot): boolean => !!s && Number.isFinite(s.lat) && Number.isFinite(s.lng) && typeof s.day === "string" && Number.isFinite(s.at);

// The store is read inside the try: where storage is blocked, reading window.localStorage itself throws.
export function loadSpots(store?: Storage): Spot[] {
  try { const raw = JSON.parse((store ?? window.localStorage).getItem(KEY) ?? "[]"); return Array.isArray(raw) ? raw.filter(isSpot).slice(0, SPOTS_MAX) : []; } catch { return []; }
}
/** The list with this spot as the newest, 20 at most. */
export const withSpot = (list: Spot[], at: Place, moving: boolean, now: Date): Spot[] =>
  [{ lat: at.lat, lng: at.lng, day: dayOf(now), at: now.getTime(), moving }, ...list].slice(0, SPOTS_MAX);
export function saveSpots(list: Spot[], store?: Storage): void {
  try { (store ?? window.localStorage).setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: asked again next time */ }
}
/** True when the customer already answered for this spot: the same day inside the near distance (less the fix's accuracy, `slack`, as for the known places), or less than 3 hours ago from a moving vehicle (at any spot). */
export const answered = (list: Spot[], at: Place, nearM: number, now: Date, slack = 0): boolean => list.some((s) => {
  const ago = now.getTime() - s.at;
  // ponytail: one speed reading at the moment of the ask, then 3 hours with no box anywhere. Ceiling: a customer who gets off the bus is not asked for up to 3 hours,
  // and a phone that gives no speed (many do) is never "moving". If that hurts: watch the place for a minute and use the distance covered, not one reading.
  if (s.moving && ago >= 0 && ago < MOVING_MS) return true;
  return s.day === dayOf(now) && distanceM(s, at) - slack <= nearM;
});
