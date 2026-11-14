// Story 1498 (boards AM1, RL1): how the customer sees the rider is one row in `settings` (rider_location_mode): off, link or map. It starts at link.
// The app reads it at start and again when it changes, the same way otpSwitch.ts reads otp_login_on: the event only says "something changed", so the row is
// read again; a missed event is healed by a poll and by the tab coming back to the front.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RiderMode = "off" | "link" | "map";
export const START_MODE: RiderMode = "link";   // also the answer when the row cannot be read: the link needs nothing from us but the place
const isMode = (v: unknown): v is RiderMode => v === "off" || v === "link" || v === "map";

export async function readRiderMode(c: Pick<SupabaseClient, "from">): Promise<RiderMode> {
  try {
    const { data, error } = await c.from("settings").select("value").eq("name", "rider_location_mode").maybeSingle();
    return !error && isMode(data?.value?.mode) ? data.value.mode : START_MODE;
  } catch {
    return START_MODE;
  }
}

export function watchRiderMode(c: Pick<SupabaseClient, "from" | "channel" | "removeChannel">, onChange: (m: RiderMode) => void, { pollMs = 30_000 } = {}): () => void {
  let alive = true;
  const read = () => { void readRiderMode(c).then((m) => { if (alive) onChange(m); }); };
  read();
  const channel = c.channel("rider-location-mode").on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: "name=eq.rider_location_mode" }, read).subscribe();
  const timer = setInterval(() => { if (typeof document === "undefined" || !document.hidden) read(); }, pollMs);
  const onVisible = () => { if (document.visibilityState === "visible") read(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); void c.removeChannel(channel); };
}

// The admin's side: who changed it and when, and the change itself. Both go through functions that check is_admin() in the database.
export type RiderModeAdmin = { mode: RiderMode; updated_by: string | null; updated_at: string };
export async function readRiderModeAdmin(c: Pick<SupabaseClient, "rpc">): Promise<RiderModeAdmin> {
  const { data, error } = await c.rpc("rider_location_mode_get_v2");
  if (error || !isMode(data?.mode)) throw error ?? new Error("no setting");
  return data as RiderModeAdmin;
}
/** null when it was saved, else a line to show. */
export async function saveRiderMode(c: Pick<SupabaseClient, "rpc">, mode: RiderMode): Promise<string | null> {
  const { data, error } = await c.rpc("rider_location_mode_set_v2", { p_mode: mode });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}

/** A tap on the rider row is counted: the order, the mode, the time. No place. A failure never gets in the way of the row. */
export async function tapRiderRow(c: Pick<SupabaseClient, "rpc">, orderId: string, mode: "link" | "map"): Promise<void> {
  try { await c.rpc("rider_row_tap", { p_order: orderId, p_mode: mode }); } catch { /* the row still opens */ }
}

type At = { lat: number; lng: number };
/** Google Maps, no key: the route from the rider's last place to the order's door by two-wheeler; with no door, the rider's place alone. */
export const riderLink = (rider: At, you: At | null): string => you
  ? `https://www.google.com/maps/dir/?api=1&origin=${rider.lat},${rider.lng}&destination=${you.lat},${you.lng}&travelmode=two-wheeler`
  : `https://www.google.com/maps/search/?api=1&query=${rider.lat},${rider.lng}`;
