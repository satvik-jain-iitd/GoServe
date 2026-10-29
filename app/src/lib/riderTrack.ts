// Story #691: the rider's place for one order. The database keeps one order_tracking row per order (migration 20261027200000, filled by the rider's 30 s pings) and the
// customer reads only their own. The realtime event only says "something changed"; the row is read again, so a missed event is healed by the next one.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toPoint, type Point } from "./riderMap";

export type LatLng = { lat: number; lng: number };

export async function readRider(client: SupabaseClient, orderId: string): Promise<Point | null> {
  const { data, error } = await client.from("order_tracking").select("rider_lat, rider_lng, updated_at").eq("order_id", orderId).maybeSingle();
  return error ? null : toPoint(data);
}

// Where "You" is: the drop point of the pin (pin_points is public).
export async function readPinPoint(client: SupabaseClient, pin: string): Promise<LatLng | null> {
  const { data, error } = await client.from("pin_points").select("lat, lng").eq("pin", pin).maybeSingle();
  return error || !data ? null : { lat: data.lat, lng: data.lng };
}

export function watchRider(client: SupabaseClient, orderId: string, onChange: () => void): () => void {
  const channel = client
    .channel(`track-${orderId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_tracking", filter: `order_id=eq.${orderId}` }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
