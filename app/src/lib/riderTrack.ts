// Story #691: the rider's place for one order. The database keeps one order_tracking row per order (migration 20261027200000, filled by the rider's 30 s pings) and the
// customer reads only their own. The realtime event only says "something changed"; the row is read again, so a missed event is healed by the next one.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toPoint, type Point } from "./riderMap";

export type LatLng = { lat: number; lng: number };

// Story 1497: both points come from the order's own row. `you` is the order's drop point (the pin the customer set); an order with none has no "You".
export type Tracked = { rider: Point; you: LatLng | null };
export async function readRider(client: SupabaseClient, orderId: string): Promise<Tracked | null> {
  const { data, error } = await client.from("order_tracking").select("rider_lat, rider_lng, rider_at, drop_lat, drop_lng").eq("order_id", orderId).maybeSingle();
  const rider = error ? null : toPoint(data);
  return rider ? { rider, you: typeof data?.drop_lat === "number" && typeof data?.drop_lng === "number" ? { lat: data.drop_lat, lng: data.drop_lng } : null } : null;
}

export function watchRider(client: SupabaseClient, orderId: string, onChange: () => void, tag = "track"): () => void {   // one channel name per watcher: a name can only be subscribed once
  const channel = client
    .channel(`${tag}-${orderId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_tracking", filter: `order_id=eq.${orderId}` }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
