// Story #619 layer d (board A9): the admin reads and changes the sold-out swap discount (a percent of the new item's price, paid by us, 0 to 50).
// The database is the truth (migration 20261029110000); this mirrors the rule so the admin gets a plain line first.
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_SWAP_PCT = 50;
export type SwapSetting = { pct: number; updated_by: string | null; updated_at: string };

export const swapPctProblem = (text: string): string | null => {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_SWAP_PCT ? null : `Pick a whole number from 0 to ${MAX_SWAP_PCT}.`;
};

export async function readSwapSetting(c: Pick<SupabaseClient, "rpc">): Promise<SwapSetting> {
  const { data, error } = await c.rpc("swap_discount_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as SwapSetting;
}

/** null when it was saved, else a line to show. */
export async function saveSwapSetting(c: Pick<SupabaseClient, "rpc">, pct: number): Promise<string | null> {
  const { data, error } = await c.rpc("swap_discount_set_v2", { p_pct: pct });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
