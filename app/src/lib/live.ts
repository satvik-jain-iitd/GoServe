// The live order list for one session (story #49): read what is there, then listen for changes (Supabase Realtime).
// Both only see what row level security allows: the device's own session and the ones it joined (ADR-010, ADR-011), or the kitchen's orders for kitchen staff (S-M5).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "./kitchen";
import type { Scope } from "./session";

export async function fetchOrders(client: SupabaseClient, scope: Scope): Promise<Order[]> {
  const { data, error } = await client.from("orders").select("*").eq(scope.column, scope.value).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

// supabase-js reports SUBSCRIBED again after every reconnect, so the caller's reload runs on each rejoin too.
// Returns a function that stops listening. onReady fires once the server confirms the subscription; the caller reads the list again
// then, so an order that arrived in the first moments is not missed.
export function watchOrders(client: SupabaseClient, scope: Scope, onOrder: (order: Order, event: string) => void, onReady?: () => void, onGone?: (id: string) => void, onDown?: () => void): () => void {
  const channel = client
    .channel(`orders-${scope.value}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `${scope.column}=eq.${scope.value}` }, (payload) => {
      if (payload.new && "id" in payload.new) onOrder(payload.new as Order, payload.eventType);
    })
    // A reset deletes orders. Delete events cannot be filtered, so every id arrives; the screen drops only the ids it holds.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (payload) => {
      const id = (payload.old as { id?: string })?.id;
      if (id) onGone?.(id);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onReady?.();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onDown?.();   // story #967: a broken channel reads at once, then the 30 s read keeps going
    });
  return () => {
    void client.removeChannel(channel);
  };
}

// Story #967: the safety net under the live channel. A change the channel missed (the phone slept, the socket dropped) still lands within 30 s.
// One read in flight at a time (a slow network never piles reads up); a failed read is tried again on the next tick. Returns a function that stops it.
export function rereadEvery(reload: () => Promise<void>, everyMs = 30_000): () => void {
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    reload().catch(() => {}).finally(() => { busy = false; });
  }, everyMs);
  return () => clearInterval(timer);
}
