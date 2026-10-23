// The rider's own row (story A5): online or offline, and the last shared location. Row level security lets a rider read and change only their own row.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RiderRow = { name: string | null; online: boolean };
export const LOCATION_EVERY_MS = 30_000;
export const shouldSendLocation = (lastSentMs: number | null, nowMs: number): boolean => lastSentMs === null || nowMs - lastSentMs >= LOCATION_EVERY_MS;

type Client = Pick<SupabaseClient, "from">;
export async function getRider(c: Client, userId: string): Promise<RiderRow | null> {
  const { data, error } = await c.from("riders").select("name, online").eq("user_id", userId).limit(1);   // kitchen staff and admins can read other riders too, so ask for this user's row
  if (error) throw error;
  return (data?.[0] as RiderRow | undefined) ?? null;
}
export async function setOnline(c: Client, userId: string, online: boolean): Promise<boolean> {
  return !(await c.from("riders").update({ online, updated_at: new Date().toISOString() }).eq("user_id", userId)).error;
}
export async function sendLocation(c: Client, userId: string, lat: number, lng: number): Promise<boolean> {
  return !(await c.from("riders").update({ lat, lng, updated_at: new Date().toISOString() }).eq("user_id", userId)).error;
}
