// Story #976: saved addresses of a customer (Home, Office, a parent's house). The rows are the customer's own (row level security); the order keeps its own copy of the text and pin.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SavedAddress = { id: string; label: string; address: string; pin: string; lat: number | null; lng: number | null; last_used_at: string; house?: string | null; landmark?: string | null };   // story 1421: house = the one box, kept whole
export type Place = { lat: number; lng: number };
export type NewAddress = { label: string; address: string; pin: string; lat?: number | null; lng?: number | null; house?: string; landmark?: string };

const R = 6_371_000;
export const distanceM = (a: Place, b: Place): number => {   // haversine: right to a metre or so over the distances that matter here
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
export const FAR_M = 2000;   // story #1056 (board SW2): past this the phone is far from the chosen address and the menu offers "Deliver here"
export const NEAR_M = 200;   // the "here" word on a row, and the start value of the setting address_near_m (story 1529: on open the saved address the phone is at is picked)
export const distanceWord = (m: number, nearM: number): string => (m <= nearM ? "here" : `${Math.max(1, Math.round(m / 1000))} km`);

const byUsed = (a: SavedAddress, b: SavedAddress) => b.last_used_at.localeCompare(a.last_used_at);

// Story 1529 (owner, 15 Nov 2026, this reverses story #1035): on open the saved address the phone is at is picked: the nearest one with a pin inside nearM. None: null.
export const hasPoint = (a: SavedAddress): a is SavedAddress & Place => a.lat !== null && a.lng !== null;
export const nearSaved = (list: SavedAddress[], at: Place, nearM: number): SavedAddress | null =>
  list.filter(hasPoint).map((a) => ({ a, m: distanceM(at, a) })).filter((x) => x.m <= nearM).sort((x, y) => x.m - y.m)[0]?.a ?? null;
/** The setting address_near_m (metres); the start value when it cannot be read. */
export async function nearM(c: Pick<SupabaseClient, "rpc">): Promise<number> {
  try { const { data } = await c.rpc("address_near_m"); return typeof data === "number" && data > 0 ? data : NEAR_M; } catch { return NEAR_M; }
}

// The row with the newest last_used_at; null for an empty list. The pick when the phone is not found (story #1035).
export const lastUsed = (list: SavedAddress[]): SavedAddress | null => [...list].sort(byUsed)[0] ?? null;

type Client = Pick<SupabaseClient, "from" | "rpc">;
// Story 1421: the box and the landmark, whole, when the sheet gave them (a row from an older path sends neither and keeps what it had).
const parts = (a: { house?: string; landmark?: string }) => (a.house === undefined ? {} : { house: a.house.trim() || null, landmark: a.landmark?.trim() || null });
const COLS = "id, label, address, pin_code, lat, lng, last_used_at, house, landmark";
type Row = { id: string; label: string; address: string; pin_code: string; lat: number | null; lng: number | null; last_used_at: string; house?: string | null; landmark?: string | null };
const fromRow = (r: Row): SavedAddress => ({ id: r.id, label: r.label, address: r.address, pin: r.pin_code, lat: r.lat, lng: r.lng, last_used_at: r.last_used_at, house: r.house ?? null, landmark: r.landmark ?? null });

export async function listAddresses(c: Client): Promise<SavedAddress[] | null> {
  const { data, error } = await c.from("addresses").select(COLS).order("last_used_at", { ascending: false });
  return error ? null : ((data ?? []) as Row[]).map(fromRow);
}
export async function addAddress(c: Client, a: NewAddress): Promise<SavedAddress | null> {
  const { data, error } = await c.from("addresses").insert({ label: a.label.trim(), address: a.address.trim(), pin_code: a.pin, lat: a.lat ?? null, lng: a.lng ?? null, ...parts(a) }).select(COLS).single();
  return error || !data ? null : fromRow(data as Row);
}
export async function editAddress(c: Client, id: string, a: { label: string; address: string; pin: string; lat?: number | null; lng?: number | null; house?: string; landmark?: string }): Promise<boolean> {   // lat and lng only when the pin was moved (story #1051)
  const moved = a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : {};
  return !(await c.from("addresses").update({ label: a.label.trim(), address: a.address.trim(), pin_code: a.pin, ...moved, ...parts(a) }).eq("id", id)).error;
}
export async function removeAddress(c: Client, id: string): Promise<boolean> {
  return !(await c.from("addresses").delete().eq("id", id)).error;
}
export async function touchAddress(c: Client, id: string): Promise<void> {
  await c.from("addresses").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}
