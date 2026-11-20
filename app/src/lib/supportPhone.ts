// Story #1659 layer 2: the admin reads and changes the support phone customers call (10-digit mobile).
// The database is the truth (migration 20261119120000); this mirrors the rule so the admin gets a plain line first.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupportPhoneSetting = { phone: string | null; updated_by: string | null; updated_at: string | null };
const BAD = "Type a 10-digit mobile number.";

/** Spaces are dropped; nothing else is guessed (no +91, no leading 0). Empty is fine: it clears the number. */
export const supportPhoneProblem = (text: string): string | null => {
  const t = text.replace(/ /g, "");
  return t === "" || /^[6-9]\d{9}$/.test(t) ? null : BAD;
};

export const showPhone = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

export async function readSupportPhoneAdmin(c: Pick<SupabaseClient, "rpc">): Promise<SupportPhoneSetting> {
  const { data, error } = await c.rpc("support_phone_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as SupportPhoneSetting;
}

/** null when it was saved, else a line to show. */
export async function saveSupportPhone(c: Pick<SupabaseClient, "rpc">, text: string): Promise<string | null> {
  const t = text.replace(/ /g, "");
  const { data, error } = await c.rpc("support_phone_set_v2", { p_phone: t === "" ? null : t });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
