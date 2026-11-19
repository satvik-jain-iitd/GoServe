// Story 1530 (board LF4b): "Recently searched". A recent is a place the customer picked from search and confirmed on the pin map. Its rows are the customer's own
// (table recent_places, row level security), so a second phone has them. It is not a saved address: no label, not in "N saved", the 20-row cap, the open-time pick or the sheet.
// Ola's terms (see supabase/functions/geocode/index.ts) say an answer of Ola is never stored in a table of ours. The customer's own recents hold the tapped result (owner, 17 Nov 2026; loan: undo recent_drop_ola()): its name and address, the confirmed point, the words typed and a postal code that is our own or his own.
import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceM } from "./addresses";
import { addressText } from "./pinMap";
import type { PlaceHit } from "./placeSearch";
import type { StoredPlace } from "./place";

export type Recent = { id: string; name: string; address: string; pin: string; lat: number; lng: number; house: string; landmark: string; used_at: string; confirmed: boolean; source: "ola" | "own" | null };   // story 1609: confirmed false = tapped in search, not yet confirmed on the map
export type Searched = { typed: string; hit: PlaceHit | null; row?: Recent };   // what the customer typed in the search, and the row he tapped
export const RECENTS_MAX = 10;   // the table keeps the newest 10 (trigger recent_places_cap)
const SAME_M = 50;   // the same words this near an older recent: that row is used again, not doubled

/** The name and the words of a recent. The tapped result's name and address are used when given (owner, 17 Nov 2026; loan: undo recent_drop_ola()). */
export function recentWords(typed: string, hit: PlaceHit | null, own: { house: string; landmark: string; area: string }, row?: Recent): { name: string; address: string } {
  return { name: (row?.name ?? hit?.name ?? typed).trim().slice(0, 80), address: addressText(own.house, own.landmark, own.area || hit?.address || row?.address || typed).slice(0, 300) };
}

type Client = Pick<SupabaseClient, "from">;
const COLS = "id, name, address, pin_code, lat, lng, house, landmark, used_at, confirmed, source";
type Row = { id: string; name: string; address: string; pin_code: string | null; lat: number; lng: number; house: string | null; landmark: string | null; used_at: string; confirmed: boolean | null; source: string | null };
const fromRow = (r: Row): Recent => ({ id: r.id, name: r.name, address: r.address, pin: r.pin_code ?? "", lat: r.lat, lng: r.lng, house: r.house ?? "", landmark: r.landmark ?? "", used_at: r.used_at, confirmed: r.confirmed ?? true, source: (r.source as Recent["source"]) ?? null });

export async function listRecents(c: Client): Promise<Recent[]> {
  const { data, error } = await c.from("recent_places").select(COLS).order("used_at", { ascending: false }).limit(RECENTS_MAX);
  return error ? [] : ((data ?? []) as Row[]).map(fromRow);
}
/** Keeps a confirmed place as the newest recent. The same name at the same place takes the older row. A failure is no recent; the place itself is not lost. */
// Story 1609: a tap in search keeps the row with confirmed false (confirmed = false); Confirm on the map passes true and updates the same row.
export async function keepRecent(c: Client, list: Recent[], r: Omit<Recent, "id" | "used_at" | "confirmed">, confirmed = true, id?: string): Promise<Recent | null> {
  if (confirmed && !r.pin) return null;   // a confirmed place with no postal code is no recent; a tap keeps its row (pin_code null), the place itself stays
  const used_at = new Date().toISOString();
  const row = { name: r.name, address: r.address, pin_code: r.pin || null, lat: r.lat, lng: r.lng, house: r.house || null, landmark: r.landmark || null, confirmed, source: r.source };   // a new row takes the server's own time
  if (id) { const next = confirmed || (list.find((x) => x.id === id)?.confirmed ?? false); const { data, error } = await c.from("recent_places").update({ ...row, used_at, confirmed: next }).eq("id", id).select(COLS).single(); return error || !data ? null : fromRow(data as Row); }   // story 1625: this row, wherever the point is; a confirmed row stays confirmed
  const same = list.find((x) => x.name === r.name && distanceM(x, r) <= SAME_M);
  if (same) { const next = confirmed || same.confirmed; return (await c.from("recent_places").update({ ...row, used_at, confirmed: next }).eq("id", same.id)).error ? null : { ...r, id: same.id, used_at, confirmed: next }; }
  const { data, error } = await c.from("recent_places").insert(row).select(COLS).single();
  return error || !data ? null : fromRow(data as Row);
}
export async function touchRecent(c: Client, id: string): Promise<void> {
  await c.from("recent_places").update({ used_at: new Date().toISOString() }).eq("id", id);
}
/** The recent the place on this phone is: the same confirmed point, and not a saved address. */
export const recentAt = (list: Recent[], p: StoredPlace | null): string | null => (p && p.confirmed && !p.id && list.find((r) => r.lat === p.lat && r.lng === p.lng)?.id) || null;
