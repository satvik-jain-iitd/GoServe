// Pin code to kitchen (story B2). The customer app asks for a pin code once, finds the open kitchen that serves it and shows that kitchen's menu.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AreaKitchen = { id: string; name: string; pin_codes: string[]; lat: number | null; lng: number | null; phone?: string | null; open: boolean; active: boolean; opens_at?: string | null; closes_at?: string | null };
export type Area = { kind: "ok"; kitchen: AreaKitchen } | { kind: "closed"; id: string; name: string; opens_at: string | null } | { kind: "none" };

export const isPin = (text: string): boolean => /^\d{6}$/.test(text);

// Kitchens that serve the pin code: an open, active one wins. Several: the nearest to `from` when it is known, else the first by name.
// (ponytail: the customer's coordinates are not collected yet, so the name order decides; a place can be passed in when they are.)
export function chooseKitchen(kitchens: AreaKitchen[], pin: string, from?: { lat: number; lng: number }): Area {
  const serving = kitchens.filter((k) => k.pin_codes.includes(pin)).sort((a, b) => a.name.localeCompare(b.name));
  if (serving.length === 0) return { kind: "none" };
  const open = serving.filter((k) => k.open && k.active);
  if (open.length === 0) return { kind: "closed", id: serving[0].id, name: serving[0].name, opens_at: serving[0].opens_at ?? null };
  const d = (k: AreaKitchen) => (from && k.lat !== null && k.lng !== null ? (k.lat - from.lat) ** 2 + (k.lng - from.lng) ** 2 : Infinity);
  return { kind: "ok", kitchen: [...open].sort((a, b) => d(a) - d(b))[0] };
}

// "10:00:00" becomes "10:00 am" (story A6).
export const openingClock = (t: string): string => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
export const openingText = (name: string, opensAt: string | null): string =>
  opensAt ? `${name} is closed right now. It opens at ${openingClock(opensAt)}.` : `${name} is closed right now. Please try again later.`;

const PIN_KEY = "gs-pin";
const KITCHEN_KEY = "gs-kitchen";
export function loadPin(store: Storage = window.localStorage): string | null {
  try {
    const p = store.getItem(PIN_KEY);
    return p && isPin(p) ? p : null;
  } catch {
    return null;
  }
}
/** Story #242 (D15): the kitchen saved for the saved pin, read at start so the menu shows at once; the network refreshes it after. */
export function loadArea(store: Storage = window.localStorage): Area | null {
  try {
    const saved = JSON.parse(store.getItem(KITCHEN_KEY) ?? "null");
    return saved?.pin && saved.pin === loadPin(store) && saved.kitchen?.id ? { kind: "ok", kitchen: saved.kitchen } : null;
  } catch { return null; }
}
export function savePin(pin: string, store: Storage = window.localStorage): void {
  try { store.setItem(PIN_KEY, pin); } catch { /* storage blocked: asked again next time */ }
}
export function forgetArea(store: Storage = window.localStorage): void {
  try { store.removeItem(PIN_KEY); store.removeItem(KITCHEN_KEY); } catch { /* nothing to forget */ }
}

export async function fetchKitchens(client: Pick<SupabaseClient, "from">): Promise<AreaKitchen[]> {
  const { data, error } = await client.from("kitchens").select("id, name, phone, pin_codes, lat, lng, open, active, opens_at, closes_at");
  if (error) throw error;
  return (data ?? []) as AreaKitchen[];
}

// Online: ask. A kitchen that worked is remembered with its pin code, so the saved menu still opens with no network.
export async function resolveArea(pin: string, fetchAll: () => Promise<AreaKitchen[]>, store: Storage = window.localStorage): Promise<Area> {
  try {
    const area = chooseKitchen(await fetchAll(), pin);
    if (area.kind === "ok") {
      try { store.setItem(KITCHEN_KEY, JSON.stringify({ pin, kitchen: area.kitchen })); } catch { /* not remembered */ }
    }
    return area;
  } catch (e) {
    try {
      const saved = JSON.parse(store.getItem(KITCHEN_KEY) ?? "null");
      if (saved?.pin === pin && saved.kitchen?.id) return { kind: "ok", kitchen: saved.kitchen };
    } catch { /* fall through */ }
    throw e;
  }
}
