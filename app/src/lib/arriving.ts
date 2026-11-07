// Story #922: the rider's Arriving tap is a row in order_events (event order.arriving). The customer reads their own rows (row level security).
// The realtime event only says "something changed"; the row is read again, so a missed event is healed by the next read or the next visit.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readArriving(client: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await client.from("order_events").select("id").eq("order_id", orderId).eq("event", "order.arriving").limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

export function watchArriving(client: SupabaseClient, orderId: string, onChange: () => void): () => void {
  const channel = client
    .channel(`arriving-${orderId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_events", filter: `order_id=eq.${orderId}` }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
