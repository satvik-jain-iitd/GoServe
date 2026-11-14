// Story 1442 (boards PD1, PD2, PD3): the rider's past days, from his own delivered orders (already on his phone; no new read of orders).
// The older cash line uses the kitchen's own rule (cashByRider: cash, delivered, not handed over, not today), so his number and the kitchen's agree.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cashInHand, dayOf, deliveredAt, isCash, type Done, type Hours } from "./kitchen";

export const MIN_DAYS = 0;
export const MAX_DAYS = 30;
export type PastDaysSetting = { days: number; updated_by: string | null; updated_at: string };
export type PastDay<T extends Done = Done> = { key: string; date: Date; orders: T[]; cash: number; due: number };
type Rpc = Pick<SupabaseClient, "rpc">;

/** The rider's read of the admin number. Throws when it failed, so the list says so and never shows an empty list as "nothing delivered". */
export async function readPastDays(c: Rpc): Promise<number> {
  const { data, error } = await c.rpc("rider_past_days");
  if (error || typeof data?.days !== "number") throw error ?? new Error("no setting");
  return data.days;
}
export async function readPastDaysAdmin(c: Rpc): Promise<PastDaysSetting> {
  const { data, error } = await c.rpc("rider_past_days_get_v2");
  if (error || !data) throw error ?? new Error("no setting");
  return data as PastDaysSetting;
}
/** null when it was saved, else a line to show. */
export async function savePastDays(c: Rpc, days: number): Promise<string | null> {
  const { data, error } = await c.rpc("rider_past_days_set_v2", { p_days: days });
  if (error) return "Could not save. Try again.";
  return data?.ok === true ? null : typeof data?.message === "string" ? data.message : "Could not save. Try again.";
}

const dayStart = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** The last `n` days before today (by the kitchen's day), newest first; only days that had a delivery. */
export const pastDays = <T extends Done>(orders: T[], n: number, now = new Date(), hours?: Hours | null): PastDay<T>[] => {
  const todayKey = dayOf(now, hours);
  const first = dayStart(new Date(todayKey)); first.setDate(first.getDate() - n);
  const byDay = new Map<string, T[]>();
  for (const o of orders) {
    if (o.status !== "delivered") continue;
    const key = dayOf(deliveredAt(o), hours);
    if (key === todayKey || new Date(key) < first) continue;
    byDay.set(key, [...(byDay.get(key) ?? []), o]);
  }
  return [...byDay.entries()].map(([key, list]) => ({
    key, date: new Date(key),
    orders: list.sort((a, b) => deliveredAt(b).localeCompare(deliveredAt(a))),
    cash: list.filter(isCash).reduce((s, o) => s + o.total_paise, 0),
    due: cashInHand(list),
  })).sort((a, b) => b.date.getTime() - a.date.getTime());
};
/** Cash of an earlier day not handed over (the kitchen's `older`), and the first day it is from. */
export const olderDue = <T extends Done>(orders: T[], now = new Date(), hours?: Hours | null): { paise: number; from: Date | null } => {
  const todayKey = dayOf(now, hours);
  const held = orders.filter((o) => o.status === "delivered" && isCash(o) && !o.cash_handed_at && dayOf(deliveredAt(o), hours) !== todayKey);
  const from = held.length ? new Date(held.map((o) => dayOf(deliveredAt(o), hours)).map((k) => new Date(k).getTime()).reduce((a, b) => Math.min(a, b))) : null;
  return { paise: cashInHand(held), from };
};
export const dayName = (d: Date): string => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(/^(\w+) /, "$1, ");
export const dayShort = (d: Date): string => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
