import type { SupabaseClient } from "@supabase/supabase-js";
import { NO_INTERNET } from "./errorLines";
// Story H7 (#190): the admin Simulator tab talks to n8n GS MAIN 30 (webhook gs-sim) with the simulator's own token. It never writes the database
// itself; the database functions behind the webhook touch rows marked synthetic only (migrations 0028 to 0030).
export class SimError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type SimAction = "status" | "seed" | "seed_kitchens" | "seed_riders" | "reset" | "tick" | "enable" | "disable" | "knobs";
export type SimDeps = { url: string; token: string; fetchFn: typeof fetch };
export type Knobs = { reject_pct: number; sold_out_pct: number; delay_pct: number; rider_drop_pct: number; demo?: boolean };
export type OrderTick = { accepted?: number; cancelled?: number; delivered?: number; dropped?: number };
export type SimAnswer = { ok: boolean; knobs?: Knobs; orders?: OrderTick | number; enabled?: boolean; kitchens?: number; kitchens_open?: number; riders?: number; riders_online?: number; dishes?: number; riders_moved?: number; kitchens_flipped?: number; dishes_flipped?: number; riders_flipped?: number; kitchens_real?: number; riders_real?: number; clear_allowed?: boolean; orders_gone?: number; skipped?: string; error?: string; message?: string };
export const simDeps = (): SimDeps => ({ url: import.meta.env.VITE_SIM_URL, token: import.meta.env.VITE_SIM_TOKEN, fetchFn: fetch.bind(window) });

export async function callSim(action: SimAction, params: Record<string, number | string | boolean>, deps: SimDeps): Promise<SimAnswer> {
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, { method: "POST", headers: { "content-type": "application/json", "x-gs-sim-token": deps.token }, body: JSON.stringify({ action, ...params }) });
  } catch {
    throw new SimError(NO_INTERNET, "network");
  }
  let answer: SimAnswer | null = null;
  try { answer = await res.json(); } catch { answer = null; }
  if (res.ok && answer && answer.ok) return answer;
  if (answer && answer.ok === false && typeof answer.message === "string") throw new SimError(answer.message, answer.error ?? "unknown");
  throw new SimError("Something went wrong. Please try again.", "unknown");
}

// What the tab shows. The seed loads the fixed Delhi list (migration 0034), so only the riders are a choice. The knobs start where the database starts (0036).
export const SEED_DEFAULTS = { riders_per_kitchen: 4, online_pct: 70 };
export const KNOB_DEFAULTS: Knobs = { reject_pct: 5, sold_out_pct: 3, delay_pct: 10, rider_drop_pct: 2 };
export const groupLine = (synthetic: number | undefined, real: number | undefined): string => `${synthetic ?? 0} synthetic · ${real ?? 0} real`;

// Story #848 (board A-Sim-Clear): Clear everything is the admin's own call to the database, never the webhook and never the simulator token.
// It shows only in a dev build (VITE_SIM_CLEAR=1) AND when the database says this one is allowed (settings row clear_allowed, set by hand on dev).
export const CLEAR_WORD = "CLEAR";
export const clearShown = (flag: string | undefined, state: SimAnswer | null): boolean => flag === "1" && state?.clear_allowed === true;
export type ClearAnswer = { ok: true; kitchens: number; riders: number; dishes: number; orders: number };
export const CLEAR_SLICE = 500;   // rows one call may touch; the database clamps it again (story 873)
const EMPTY_SLICES = 3;           // slices in a row that did nothing and did not say done: something is wrong, stop
/** Clear in slices (story 873, "future me bhi chale chahe data badh bhi jaye"): each call does one slice and says whether it is done; call again until it is.
 * onProgress gets the running totals after every slice. Any error stops the loop with its true reason (story 869). */
export async function clearAll(c: Pick<SupabaseClient, "rpc">, onProgress?: (t: ClearAnswer) => void): Promise<ClearAnswer> {
  const total: ClearAnswer = { ok: true, kitchens: 0, riders: 0, dishes: 0, orders: 0 };
  let idle = 0;
  for (;;) {
    const { data, error } = await c.rpc("sim_clear_all", { p_limit: CLEAR_SLICE });
    if (error) {
      console.error("sim_clear_all failed", error);   // story 869: the full error is readable in the browser
      if (error.message?.includes("not_admin")) throw new SimError("Only an admin can clear the city.", "not_admin");
      // An admin sees the true reason, for example "JWT expired (PGRST301)" (rule 20), not a generic line.
      throw new SimError(error.message ? `${error.message}${error.code ? ` (${error.code})` : ""}` : "Something went wrong. Please try again.", error.code || "unknown");
    }
    if (data?.ok !== true) throw new SimError(typeof data?.message === "string" ? data.message : "Something went wrong. Please try again.", data?.error ?? "unknown");
    total.kitchens += data.kitchens ?? 0; total.riders += data.riders ?? 0; total.dishes += data.dishes ?? 0; total.orders += data.orders ?? 0;
    onProgress?.({ ...total });
    if (data.done !== false) return total;
    idle = (data.logs_detached ?? 0) + (data.orders ?? 0) === 0 ? idle + 1 : 0;
    if (idle >= EMPTY_SLICES) throw new SimError("Clear everything stopped: it is not making progress. Try again, and tell the developer if it repeats.", "no_progress");
  }
}

export const countsLine = (a: SimAnswer): string => `${a.kitchens ?? 0} kitchens · ${a.riders ?? 0} riders (${a.riders_online ?? 0} online) · ${a.dishes ?? 0} dishes`;
export const tickLine = (a: SimAnswer): string => {
  if (a.skipped) return "Tick: the city is off, nothing moved.";
  const o = typeof a.orders === "object" ? a.orders : null;
  const orders = o ? ` Orders: ${o.accepted ?? 0} accepted, ${o.cancelled ?? 0} turned away, ${o.delivered ?? 0} delivered, ${o.dropped ?? 0} riders dropped.` : "";
  return `Tick: ${a.riders_moved ?? 0} riders moved, ${a.kitchens_flipped ?? 0} kitchen${a.kitchens_flipped === 1 ? "" : "s"} flipped, ${a.dishes_flipped ?? 0} dishes flipped, ${a.riders_flipped ?? 0} rider${a.riders_flipped === 1 ? "" : "s"} flipped.${orders}`;
};
