// Story H14 (#204): small calls that feed the pilot numbers. The first two never get in the way of the screen: a failure is ignored.
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = Pick<SupabaseClient, "rpc">;
export async function savePlatform(c: Client, orderId: string, platform: string): Promise<void> {
  try { await c.rpc("order_platform", { p_order: orderId, p_platform: platform }); } catch { /* the order is placed either way */ }
}
export async function tapCall(c: Client, orderId: string): Promise<void> {
  try { await c.rpc("customer_call", { p_order: orderId }); } catch { /* the call link still opens the phone */ }
}
/** The assigned rider ends an order that is on the way: the customer refused or was not there. */
export async function riderRefused(c: Client, orderId: string): Promise<boolean> {
  const { error } = await c.rpc("rider_refused", { p_order: orderId });
  return !error;
}
