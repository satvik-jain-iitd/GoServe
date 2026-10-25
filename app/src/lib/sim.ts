// Story H7 (#190): the admin Simulator tab talks to n8n GS MAIN 30 (webhook gs-sim) with the simulator's own token. It never writes the database
// itself; the database functions behind the webhook touch rows marked synthetic only (migrations 0028 to 0030).
export class SimError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type SimAction = "status" | "seed" | "reset" | "tick" | "enable" | "disable";
export type SimDeps = { url: string; token: string; fetchFn: typeof fetch };
export type SimAnswer = { ok: boolean; enabled?: boolean; kitchens?: number; kitchens_open?: number; riders?: number; riders_online?: number; dishes?: number; orders?: number; riders_moved?: number; kitchens_flipped?: number; dishes_flipped?: number; riders_flipped?: number; skipped?: string; error?: string; message?: string };
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

// The seed parameters the tab shows; the server clamps them again (1 to 50 kitchens, 1 to 200 riders, 1 to 12 dishes).
export const SEED_DEFAULTS = { kitchens: 10, riders: 20, dishes_per_kitchen: 6, seed: 42, open_pct: 80, online_pct: 70 };
export const countsLine = (a: SimAnswer): string => `${a.kitchens ?? 0} kitchens · ${a.riders ?? 0} riders (${a.riders_online ?? 0} online) · ${a.dishes ?? 0} dishes`;
export const tickLine = (a: SimAnswer): string => a.skipped ? "Tick: the city is off, nothing moved." : `Tick: ${a.riders_moved ?? 0} riders moved, ${a.kitchens_flipped ?? 0} kitchen${a.kitchens_flipped === 1 ? "" : "s"} flipped, ${a.dishes_flipped ?? 0} dishes flipped, ${a.riders_flipped ?? 0} rider${a.riders_flipped === 1 ? "" : "s"} flipped.`;
