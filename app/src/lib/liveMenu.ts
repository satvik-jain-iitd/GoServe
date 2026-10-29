// Story #619 (boards L1, L2): the menu follows the kitchen. A change to the kitchen row (the switch, the hours) or to one of its dishes (sold out, back)
// reaches the phone in seconds. Both tables are in the realtime publication (migration 0049) and readable by anyone (the menu is public).
// The caller reads the rows again when this fires: the event only says "something changed", so a missed event is healed by the next read.
import type { SupabaseClient } from "@supabase/supabase-js";

export function watchMenu(client: SupabaseClient, kitchenId: string, onChange: () => void): () => void {
  const channel = client
    .channel(`menu-${kitchenId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "kitchens", filter: `id=eq.${kitchenId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `kitchen_id=eq.${kitchenId}` }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
