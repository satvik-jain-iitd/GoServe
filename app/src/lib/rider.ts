// The rider's own row (story A5): online or offline, and the last shared location. Row level security lets a rider read and change only their own row.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hhmmOf, type Hours } from "./kitchen";

export type RiderRow = { name: string | null; phone?: string | null; online: boolean };
export type KitchenCard = { name: string; address: string | null; opens_at?: string | null; closes_at?: string | null; lat?: number | null; lng?: number | null; phone?: string | null };
/** What the rider screens get from the gate (story H11): who, online or not, and the two taps. Null in the demo console. */
export type RiderGateState = { name: string | null; phone: string | null; online: boolean; flip: () => Promise<void>; signOut: () => void };
export const LOCATION_EVERY_MS = 30_000;
/** Story 1182: the rider is "near" the door within this many metres of the order's pin, and the Arriving button shows. A guess (docs/assumptions.md). */
export const DOOR_NEAR_M = 150;
export const shouldSendLocation = (lastSentMs: number | null, nowMs: number): boolean => lastSentMs === null || nowMs - lastSentMs >= LOCATION_EVERY_MS;

type Client = Pick<SupabaseClient, "from" | "rpc">;
export async function getRider(c: Client, userId: string): Promise<RiderRow | null> {
  const { data, error } = await c.from("riders").select("name, phone, online").eq("user_id", userId).limit(1);   // kitchen staff and admins can read other riders too, so ask for this user's row
  if (error) throw error;
  return (data?.[0] as RiderRow | undefined) ?? null;
}
export async function setOnline(c: Client, userId: string, online: boolean): Promise<boolean> {
  return !(await c.from("riders").update({ online, updated_at: new Date().toISOString() }).eq("user_id", userId)).error;
}
// Story H14: rider_ping updates the rider's last place and keeps one history row (for the location-gap number).
export async function sendLocation(c: Client, lat: number, lng: number): Promise<boolean> {
  return !(await c.rpc("rider_ping", { p_lat: lat, p_lng: lng })).error;
}

// Story H11 (#194): the kitchen to pick up at, by the order's kitchen_id. Null when the row cannot be read.
export async function fetchKitchen(c: Pick<SupabaseClient, "from">, kitchenId: string): Promise<KitchenCard | null> {
  const { data, error } = await c.from("kitchens").select(KITCHEN_COLS).eq("id", kitchenId).limit(1);
  if (error) throw error;
  return (data?.[0] as KitchenCard | undefined) ?? null;
}
const KITCHEN_COLS = "name, address, opens_at, closes_at, lat, lng, phone";   // stories 1445 and 1440: the point and the phone for the Me rows
/** Stories 1445 and 1440: a rider on his first day has no order yet, so no kitchen. When exactly one real kitchen is active, it is his; else null (never a wrong place). */
export async function fetchOnlyKitchen(c: Pick<SupabaseClient, "from">): Promise<KitchenCard | null> {
  const { data, error } = await c.from("kitchens").select(KITCHEN_COLS).eq("active", true).eq("synthetic", false).limit(2);
  return !error && data?.length === 1 ? (data[0] as KitchenCard) : null;
}
/** The cash the rider holds from today's deliveries: every order is cash at the door (paid_by unset or "cash"). */
export { cashInHand, handedOver } from "./kitchen";   // story #229: one cash rule for both screens
/** The kitchen's hours as the cash day needs them ("HH:MM" or null). */
export const hoursOf = (k: KitchenCard | null): Hours | null => (k ? { opens: hhmmOf(k.opens_at), closes: hhmmOf(k.closes_at) } : null);
export const firstName = (name: string | null | undefined): string => (name ?? "").trim().split(/\s+/)[0] || "customer";

/** Story 1448: the rider puts a wrong cash or UPI tap right on a delivered order. Null when saved; else the refusal (handed_over, order_not_found, bad_method) or "failed". */
export async function riderChangePaid(c: Pick<SupabaseClient, "rpc">, orderId: string, method: "cash" | "upi_door"): Promise<string | null> {
  const { data, error } = await c.rpc("rider_change_paid", { p_order: orderId, p_method: method });
  if (error) return "failed";
  const r = data as { ok?: boolean; error?: string } | null;
  return r?.ok ? null : r?.error ?? "failed";
}
