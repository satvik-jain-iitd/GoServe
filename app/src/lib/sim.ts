// Story H7 (#190): the admin Simulator tab talks to n8n GS MAIN 30 (webhook gs-sim) with the simulator's own token. It never writes the database
// itself; the database functions behind the webhook touch rows marked synthetic only (migrations 0028 to 0030).
export class SimError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type SimAction = "status" | "seed" | "reset" | "tick" | "enable" | "disable" | "knobs";
export type SimDeps = { url: string; token: string; fetchFn: typeof fetch };
export type Knobs = { reject_pct: number; sold_out_pct: number; delay_pct: number; rider_drop_pct: number };
export type OrderTick = { accepted?: number; cancelled?: number; delivered?: number; dropped?: number };
export type SimAnswer = { ok: boolean; knobs?: Knobs; orders?: OrderTick | number; enabled?: boolean; kitchens?: number; kitchens_open?: number; riders?: number; riders_online?: number; dishes?: number; riders_moved?: number; kitchens_flipped?: number; dishes_flipped?: number; riders_flipped?: number; skipped?: string; error?: string; message?: string };
export const simDeps = (): SimDeps => ({ url: import.meta.env.VITE_SIM_URL, token: import.meta.env.VITE_SIM_TOKEN, fetchFn: fetch.bind(window) });

export async function callSim(action: SimAction, params: Record<string, number | string>, deps: SimDeps): Promise<SimAnswer> {
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, { method: "POST", headers: { "content-type": "application/json", "x-gs-sim-token": deps.token }, body: JSON.stringify({ action, ...params }) });
  } catch {
    throw new SimError("No network. Check your connection and try again.", "network");
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
export const countsLine = (a: SimAnswer): string => `${a.kitchens ?? 0} kitchens · ${a.riders ?? 0} riders (${a.riders_online ?? 0} online) · ${a.dishes ?? 0} dishes`;
export const tickLine = (a: SimAnswer): string => {
  if (a.skipped) return "Tick: the city is off, nothing moved.";
  const o = typeof a.orders === "object" ? a.orders : null;
  const orders = o ? ` Orders: ${o.accepted ?? 0} accepted, ${o.cancelled ?? 0} turned away, ${o.delivered ?? 0} delivered, ${o.dropped ?? 0} riders dropped.` : "";
  return `Tick: ${a.riders_moved ?? 0} riders moved, ${a.kitchens_flipped ?? 0} kitchen${a.kitchens_flipped === 1 ? "" : "s"} flipped, ${a.dishes_flipped ?? 0} dishes flipped, ${a.riders_flipped ?? 0} rider${a.riders_flipped === 1 ? "" : "s"} flipped.${orders}`;
};
