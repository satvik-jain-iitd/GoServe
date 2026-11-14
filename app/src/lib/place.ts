// Story 1532: the one delivery place this phone holds, read and written as one thing: the point, the words, the postal code, the house, the landmark and a confirmed mark.
// Before it the point lived only in memory and was dropped when the words changed, so an order could leave with no point.
// confirmed: the customer set this point (a saved address with its pin, or "Confirm & proceed" on the pin map). A raw phone fix has a point and is not confirmed.
// id: the saved address row this place is, or null (a place whose save failed, or a place that is not saved).
import { forgetArea, isPin, loadPin, savePin } from "./area";
import { loadDraft } from "./draft";

export type StoredPlace = { address: string; pin: string; lat: number | null; lng: number | null; house: string; landmark: string; confirmed: boolean; id: string | null };

const KEY = "gs-place";
const text = (v: unknown) => (typeof v === "string" ? v : "");

export function loadPlace(store: Storage = window.localStorage): StoredPlace | null {
  try {
    const raw = JSON.parse(store.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object" && isPin(text(raw.pin))) {
      const has = Number.isFinite(raw.lat) && Number.isFinite(raw.lng);
      return { address: text(raw.address), pin: raw.pin, lat: has ? raw.lat : null, lng: has ? raw.lng : null, house: text(raw.house), landmark: text(raw.landmark), confirmed: has && raw.confirmed === true, id: text(raw.id) || null };
    }
  } catch { /* storage blocked or damaged: the older keys below, else no place */ }
  const pin = loadPin(store);   // a phone that last ran a build before this story: the postal code and the typed words, no point. It must be confirmed on the map before an order.
  return pin ? { address: loadDraft(store).address, pin, lat: null, lng: null, house: "", landmark: "", confirmed: false, id: null } : null;
}

// The postal code is also kept under its own key: the remembered kitchen (lib/area.ts, loadArea) is checked against it.
export function savePlace(p: StoredPlace, store: Storage = window.localStorage): void {
  savePin(p.pin, store);
  try { store.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked: asked again next time */ }
}

export function clearPlace(store: Storage = window.localStorage): void {
  forgetArea(store);
  try { store.removeItem(KEY); } catch { /* nothing to forget */ }
}

/** The point an order may carry: only a confirmed one. */
export const pointOf = (p: StoredPlace | null): { lat: number; lng: number } | null =>
  p && p.confirmed && p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null;

// Story 1529: the phone's own fix as a place ("Where you are now"): the point and the postal code of that point. Not confirmed and not a saved row, so no order goes to it
// before "Confirm on the map". It is kept only as this phone's place, never as an address row.
export const HERE = "Where you are now";
export const herePlace = (at: { lat: number; lng: number }, pin: string): StoredPlace => ({ address: HERE, pin, lat: at.lat, lng: at.lng, house: "", landmark: "", confirmed: false, id: null });
export const isHere = (p: StoredPlace | null): boolean => !!p && p.address === HERE && !p.confirmed && p.id === null;
