// Story #976: saved addresses of a customer (Home, Office, a parent's house). The rows are the customer's own (row level security); the order keeps its own copy of the text and pin.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SavedAddress = { id: string; label: string; address: string; pin: string; lat: number | null; lng: number | null; last_used_at: string };
export type Place = { lat: number; lng: number };
export type NewAddress = { label: string; address: string; pin: string; lat?: number | null; lng?: number | null };

const R = 6_371_000;
export const distanceM = (a: Place, b: Place): number => {   // haversine: right to a metre or so over the distances that matter here
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
export const distanceWord = (m: number, nearM: number): string => (m <= nearM ? "here" : `${Math.max(1, Math.round(m / 1000))} km`);

const placeOf = (a: SavedAddress): Place | null => (typeof a.lat === "number" && typeof a.lng === "number" ? { lat: a.lat, lng: a.lng } : null);
const byUsed = (a: SavedAddress, b: SavedAddress) => b.last_used_at.localeCompare(a.last_used_at);

// On open: the saved address nearest the phone and within `nearM` is picked. Far from all of them, none is picked and the Deliver to page asks.
// No phone place (no permission): the last used one stays picked. A row with no place of its own is never measured.
export function pickOnOpen(list: SavedAddress[], here: Place | null, nearM: number): { id: string | null; asks: boolean } {
  if (list.length === 0) return { id: null, asks: false };
  if (!here) return { id: [...list].sort(byUsed)[0].id, asks: false };
  let best: { id: string; m: number } | null = null;
  for (const a of list) {
    const p = placeOf(a);
    if (!p) continue;
    const m = distanceM(here, p);
    if (m <= nearM && (!best || m < best.m)) best = { id: a.id, m };
  }
  return best ? { id: best.id, asks: false } : { id: null, asks: true };
}

// The single address saved before this story becomes the first row, labelled Home. A missing address or a pin that is not six digits makes nothing.
export function firstFromProfile(p: { address: string; pin: string | null }): NewAddress | null {
  const address = p.address.trim();
  return address.length >= 5 && /^\d{6}$/.test(p.pin ?? "") ? { label: "Home", address, pin: p.pin as string } : null;
}

type Client = Pick<SupabaseClient, "from" | "rpc">;
const COLS = "id, label, address, pin_code, lat, lng, last_used_at";
type Row = { id: string; label: string; address: string; pin_code: string; lat: number | null; lng: number | null; last_used_at: string };
const fromRow = (r: Row): SavedAddress => ({ id: r.id, label: r.label, address: r.address, pin: r.pin_code, lat: r.lat, lng: r.lng, last_used_at: r.last_used_at });

export async function listAddresses(c: Client): Promise<SavedAddress[] | null> {
  const { data, error } = await c.from("addresses").select(COLS).order("last_used_at", { ascending: false });
  return error ? null : ((data ?? []) as Row[]).map(fromRow);
}
export async function addAddress(c: Client, a: NewAddress): Promise<SavedAddress | null> {
  const { data, error } = await c.from("addresses").insert({ label: a.label.trim(), address: a.address.trim(), pin_code: a.pin, lat: a.lat ?? null, lng: a.lng ?? null }).select(COLS).single();
  return error || !data ? null : fromRow(data as Row);
}
export async function editAddress(c: Client, id: string, a: { label: string; address: string; pin: string }): Promise<boolean> {
  return !(await c.from("addresses").update({ label: a.label.trim(), address: a.address.trim(), pin_code: a.pin }).eq("id", id)).error;
}
export async function removeAddress(c: Client, id: string): Promise<boolean> {
  return !(await c.from("addresses").delete().eq("id", id)).error;
}
export async function touchAddress(c: Client, id: string): Promise<void> {
  await c.from("addresses").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}
export async function nearMetres(c: Client): Promise<number> {
  const { data, error } = await c.rpc("address_near_m");
  return !error && typeof data === "number" && data > 0 ? data : 200;
}
