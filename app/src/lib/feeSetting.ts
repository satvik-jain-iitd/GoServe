// Story 1756: the admin reads and changes the delivery fee (whole rupees, 0 to 200, on every order). Money is paise in the database (migration 20261122100000).
// The database is the truth; this mirrors the rule so the admin gets a plain line first.
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_FEE_RUPEES = 200;
export type FeeSetting = { amount_paise: number; updated_by: string | null; updated_at: string };

export const feeProblem = (text: string): string | null => {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_FEE_RUPEES ? null : `Type 0 to ${MAX_FEE_RUPEES} rupees.`;
};

export async function readFeeSetting(c: Pick<SupabaseClient, "rpc">): Promise<FeeSetting> {
  const { data, error } = await c.rpc("delivery_fee_get_v1");
  if (error || !data) throw error ?? new Error("no setting");
  return data as FeeSetting;
}

/** null when it was saved (also when it was the same value), else a line to show. */
export async function saveFeeSetting(c: Pick<SupabaseClient, "rpc">, rupees: number): Promise<string | null> {
  const { data, error } = await c.rpc("delivery_fee_set_v1", { p_amount_paise: rupees * 100 });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
