// Story #922: the rider's Arriving tap is a row in order_events (event order.arriving). The customer reads their own rows (row level security).
// The realtime event only says "something changed"; the row is read again, so a missed event is healed by the next read or the next visit.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readArriving(client: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await client.from("order_events").select("id").eq("order_id", orderId).eq("event", "order.arriving").limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

// Story 1507 (board ST1): when each step of the customer's own order happened. The time is the event's own (created_at), the first of its kind.
// A status with no event row has no time. The rider's pickup (order.picked_up) is the customer's "On the way".
const STEP_OF: Record<string, string> = { "order.placed": "placed", "order.accepted": "accepted", "order.preparing": "preparing", "order.ready": "ready", "order.picked_up": "out_for_delivery", "order.delivered": "delivered" };
export type StepTimes = Record<string, string>;
export async function readStepTimes(client: SupabaseClient, orderId: string): Promise<StepTimes | null> {
  const { data, error } = await client.from("order_events").select("event, created_at").eq("order_id", orderId).order("created_at", { ascending: true });
  if (error || !Array.isArray(data)) return null;   // a failed read: the caller keeps what it has
  const out: StepTimes = {};
  for (const r of data as { event: string; created_at: string }[]) { const s = STEP_OF[r.event]; if (s && r.created_at && !out[s]) out[s] = r.created_at; }
  return out;
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

// Story 1182 (boards RY1 to RY3): the rider cannot read order_events, so two narrow database functions serve the door steps.
type Rpc = Pick<SupabaseClient, "rpc">;
/** When Arriving was sent for the rider's own order, or null (not yet, not theirs, or the read failed). A reload or a second phone opens step 3 from this. */
export async function riderArrivingAt(c: Rpc, orderId: string): Promise<string | null> {
  const { data, error } = await c.rpc("rider_arriving_at", { p_order: orderId });
  return !error && typeof data === "string" ? data : null;
}
/** The rider tapped "I am at the door" while the phone said they were far (metres) or had no place (null). A failure is ignored: the step still moves. */
export async function riderAtDoor(c: Rpc, orderId: string, metres: number | null): Promise<void> {
  try { await c.rpc("rider_at_door", { p_order: orderId, p_metres: metres }); } catch { /* the rider goes on either way */ }
}
