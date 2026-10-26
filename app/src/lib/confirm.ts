// When the app asks "Was your order delivered?" and what a Not yet does (story S-C, #95, ADR-015). Pure timing; the server owns the times (MAIN 01 Config).
export type ConfirmCfg = { afterReadyMin: number; afterPlaceMin: number };   // afterPlaceMin is still sent by the server (MAIN 01 Config) but no longer used (#456)
export const DEFAULT_CFG: ConfirmCfg = { afterReadyMin: 3, afterPlaceMin: 8 };
export const REASK_MS = 2 * 60_000;
export const reaskMs = (): number => Number(import.meta.env?.VITE_REASK_MS) || REASK_MS;
const MIN = 60_000;

type Timed = { status: string; created_at: string; updated_at: string };

// The moment to ask, in ms. Only when the food can be at the door: 3 minutes after Ready, or 3 minutes after the rider left. Never while the kitchen is still
// working (placed, accepted, preparing), and never after Delivered (#456: the old "8 minutes after placing" asked a customer whose slip still said Cooking, and the Yes failed).
export function confirmAt(o: Timed, cfg: ConfirmCfg): number | null {
  if (o.status === "ready" || o.status === "out_for_delivery") return Date.parse(o.updated_at) + cfg.afterReadyMin * MIN;
  return null;
}

// `count` is how many times the customer has tapped Not yet, including this tap. The third one opens the Feedback sheet.
export function notYet(count: number, now: number, wait = REASK_MS): { feedback: boolean; askAgainAt: number | null } {
  return count >= 3 ? { feedback: true, askAgainAt: null } : { feedback: false, askAgainAt: now + wait };
}
