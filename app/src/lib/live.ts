// The live order list for one session (story #49): read what is there, then listen for changes (Supabase Realtime).
// Both only see this session's rows: row level security allows the device's own session and the ones it joined (ADR-010, ADR-011).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "./kitchen";

export async function fetchOrders(client: SupabaseClient, sessionId: string): Promise<Order[]> {
  const { data, error } = await client.from("orders").select("*").eq("session_id", sessionId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

// supabase-js reports SUBSCRIBED again after every reconnect, so the caller's reload runs on each rejoin too.
// Returns a function that stops listening. onReady fires once the server confirms the subscription; the caller reads the list again
// then, so an order that arrived in the first moments is not missed.
export function watchOrders(client: SupabaseClient, sessionId: string, onOrder: (order: Order) => void, onReady?: () => void, onGone?: (id: string) => void): () => void {
  const channel = client
    .channel(`orders-${sessionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `session_id=eq.${sessionId}` }, (payload) => {
      if (payload.new && "id" in payload.new) onOrder(payload.new as Order);
    })
    // A reset deletes orders. Delete events cannot be filtered, so every id arrives; the screen drops only the ids it holds.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (payload) => {
      const id = (payload.old as { id?: string })?.id;
      if (id) onGone?.(id);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onReady?.();
    });
  return () => {
    void client.removeChannel(channel);
  };
}
