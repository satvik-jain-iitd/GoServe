// Story #1329 (board A11, same shape as A10): the admin turns the early-friend offer on or off and sets its amount. The database is the truth
// (migration 20261110160000); this mirrors the amount rule so the admin gets a plain line first.
import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_RUPEES = 10;
export const MAX_RUPEES = 500;
export type EarlyFriendSetting = { on: boolean; amount_paise: number; updated_by: string | null; updated_at: string };

export const amountProblem = (text: string): string | null => {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= MIN_RUPEES && n <= MAX_RUPEES ? null : `Pick a whole number of rupees from ${MIN_RUPEES} to ${MAX_RUPEES}.`;
};

export async function readEarlyFriend(c: Pick<SupabaseClient, "rpc">): Promise<EarlyFriendSetting> {
  const { data, error } = await c.rpc("early_friend_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as EarlyFriendSetting;
}

/** null when it was saved, else a line to show. */
export async function saveEarlyFriend(c: Pick<SupabaseClient, "rpc">, on: boolean, rupees: number): Promise<string | null> {
  const { data, error } = await c.rpc("early_friend_set_v2", { p_on: on, p_amount_paise: rupees * 100 });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
