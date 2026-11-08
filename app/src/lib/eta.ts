// Story #1015 (board E2a): the delivery time comes from the server. order_tracking carries eta_lo_min, eta_hi_min and eta_late (migration 20261108130000), kept by the database
// on every status change and rider ping. The screen shows the best estimate (lo) as one big number that counts down between answers, and the clock time it lands on. Never a number
// the server did not give: with no answer, or no place to work from, the line says it is working it out.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Eta = { lo: number | null; late: boolean; at: string };
export type EtaView = { kind: "working" } | { kind: "late" } | { kind: "time"; min: number; by: Date };

export async function readEta(client: SupabaseClient, orderId: string): Promise<Eta | null> {
  const { data, error } = await client.from("order_tracking").select("eta_lo_min, eta_late, updated_at").eq("order_id", orderId).maybeSingle();
  return error || !data ? null : { lo: data.eta_lo_min ?? null, late: !!data.eta_late, at: data.updated_at };
}

export function etaView(eta: Eta | null | undefined, now: number): EtaView {
  if (!eta || eta.lo === null) return { kind: "working" };
  if (eta.late) return { kind: "late" };
  const start = new Date(eta.at).getTime();
  return { kind: "time", min: Math.max(1, Math.ceil(eta.lo - (now - start) / 60_000)), by: new Date(start + eta.lo * 60_000) };
}
