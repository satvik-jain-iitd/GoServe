// When the app asks "Was your order delivered?" and what a Not yet does (story S-C, #95, ADR-015). Pure timing; the server owns the times (MAIN 01 Config).
export type ConfirmCfg = { afterReadyMin: number; afterPlaceMin: number };
export const DEFAULT_CFG: ConfirmCfg = { afterReadyMin: 3, afterPlaceMin: 8 };
export const REASK_MS = 2 * 60_000;
export const reaskMs = (): number => Number(import.meta.env?.VITE_REASK_MS) || REASK_MS;
const MIN = 60_000;

type Timed = { status: string; created_at: string; updated_at: string };

// The moment to ask, in ms. After Ready: 3 minutes later, but never later than 8 minutes after the order was placed. Otherwise 8 minutes after placing. Delivered: never.
export function confirmAt(o: Timed, cfg: ConfirmCfg): number | null {
  if (o.status === "delivered") return null;
  const byPlace = Date.parse(o.created_at) + cfg.afterPlaceMin * MIN;
  if (o.status === "ready") return Math.min(Date.parse(o.updated_at) + cfg.afterReadyMin * MIN, byPlace);
  return byPlace;
}

// `count` is how many times the customer has tapped Not yet, including this tap. The third one opens the Feedback sheet.
export function notYet(count: number, now: number, wait = REASK_MS): { feedback: boolean; askAgainAt: number | null } {
  return count >= 3 ? { feedback: true, askAgainAt: null } : { feedback: false, askAgainAt: now + wait };
}
