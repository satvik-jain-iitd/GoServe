// The rider's own row (story A5): online or offline, and the last shared location. Row level security lets a rider read and change only their own row.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hhmmOf, type Hours } from "./kitchen";

export type RiderRow = { name: string | null; phone?: string | null; online: boolean };
export type KitchenCard = { name: string; address: string | null; opens_at?: string | null; closes_at?: string | null };
/** What the rider screens get from the gate (story H11): who, online or not, and the two taps. Null in the demo console. */
export type RiderGateState = { name: string | null; phone: string | null; online: boolean; flip: () => Promise<void>; signOut: () => void };
export const LOCATION_EVERY_MS = 30_000;
/** The words on the Offline and Me screens, built from LOCATION_EVERY_MS so they never drift: "every 30 seconds". */
export const locationLabel = (): string => `every ${LOCATION_EVERY_MS / 1000} seconds`;
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
  const { data, error } = await c.from("kitchens").select("name, address, opens_at, closes_at").eq("id", kitchenId).limit(1);
  if (error) throw error;
  return (data?.[0] as KitchenCard | undefined) ?? null;
}
/** The cash the rider holds from today's deliveries: every order is cash at the door (paid_by unset or "cash"). */
export { cashInHand, handedOver } from "./kitchen";   // story #229: one cash rule for both screens
/** The kitchen's hours as the cash day needs them ("HH:MM" or null). */
export const hoursOf = (k: KitchenCard | null): Hours | null => (k ? { opens: hhmmOf(k.opens_at), closes: hhmmOf(k.closes_at) } : null);
export const firstName = (name: string | null | undefined): string => (name ?? "").trim().split(/\s+/)[0] || "customer";
