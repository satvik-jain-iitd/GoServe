// Stories 1443 and 1438 (boards TI1 and AR1): an amount for each delivery, set by the admin, paid with the salary, never part of the cash he holds.
// The database is the truth (migration 20261114100000); each delivery counts at the rate in force when it was delivered.
import type { SupabaseClient } from "@supabase/supabase-js";

export const STEP_RUPEES = 5;
export const MIN_RUPEES = 5;
export const MAX_RUPEES = 100;
export type IncentiveSetting = { on: boolean; amount_paise: number; updated_by: string | null; updated_at: string };
export type Rate = { at: string; on: boolean; amount_paise: number };
export type Rates = { on: boolean; amount_paise: number; log: Rate[] };
type Rpc = Pick<SupabaseClient, "rpc">;

export async function readIncentive(c: Rpc): Promise<IncentiveSetting> {
  const { data, error } = await c.rpc("rider_incentive_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as IncentiveSetting;
}
/** null when it was saved, else a line to show. */
export async function saveIncentive(c: Rpc, on: boolean, rupees: number): Promise<string | null> {
  const { data, error } = await c.rpc("rider_incentive_set_v2", { p_on: on, p_amount_paise: rupees * 100 });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}
/** The rider's read: the switch now and the recent changes. Null when it failed (the row then never shows a guess). */
export async function readRates(c: Rpc): Promise<Rates | null> {
  const { data, error } = await c.rpc("rider_incentive_rates");
  return !error && data && typeof (data as Rates).on === "boolean" ? (data as Rates) : null;
}

/** Each delivery at the rate in force when it was delivered (updated_at). Before the first change it is off. */
export function incentiveFor(delivered: { updated_at: string }[], log: Rate[]): { count: number; total_paise: number; amounts: number[] } {
  const sorted = [...log].sort((a, b) => a.at.localeCompare(b.at));
  let count = 0, total = 0;
  const amounts = new Set<number>();
  for (const o of delivered) {
    const t = Date.parse(o.updated_at);
    const rate = sorted.filter((r) => Date.parse(r.at) <= t).at(-1);
    if (rate?.on) { count++; total += rate.amount_paise; amounts.add(rate.amount_paise); }
  }
  return { count, total_paise: total, amounts: [...amounts] };
}
