// Story 1672 (epic 1652): the admin's two hand-over code switches. kitchen = pickup_code_on, customer = drop_code_on in `settings`.
// Both go through functions that check is_admin() in the database (migration 20261124190000), the same shape as otpSwitch.ts.
import type { SupabaseClient } from "@supabase/supabase-js";

export type HandoverWhich = "kitchen" | "customer";
export type HandoverSwitches = Record<HandoverWhich, { on: boolean; updated_by: string | null; updated_at: string | null }>;

export async function readHandoverSwitches(c: Pick<SupabaseClient, "rpc">): Promise<HandoverSwitches> {
  const { data, error } = await c.rpc("handover_switch_get_v1");
  if (error || !data) throw error ?? new Error("no switches");
  return data as HandoverSwitches;
}

/** null when it was saved, else a line to show. */
export async function saveHandoverSwitch(c: Pick<SupabaseClient, "rpc">, which: HandoverWhich, on: boolean): Promise<string | null> {
  const { data, error } = await c.rpc("handover_switch_set_v1", { p_which: which, p_on: on });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
