// Story S-C (#95): when the app asks "Was your order delivered?", and what each answer does. Pure timing, no network.
import { describe, expect, it } from "vitest";
import { confirmAt, mayAsk, notYet, REASK_MS, type ConfirmCfg } from "../../src/lib/confirm";

const cfg: ConfirmCfg = { afterReadyMin: 3, afterPlaceMin: 8 };
const at = (iso: string) => Date.parse(iso);
const order = (status: string, updated = "2026-10-15T20:40:00Z", created = "2026-10-15T20:30:00Z") => ({ status, created_at: created, updated_at: updated });

describe("confirmAt", () => {
  it("S1 asks 3 minutes after Ready", () => {
    expect(confirmAt(order("ready", "2026-10-15T20:40:00Z", "2026-10-15T20:38:00Z"), cfg)).toBe(at("2026-10-15T20:43:00Z"));
  });
  it("S1 Ready asks 3 minutes later even when the order was placed more than 8 minutes before (#456)", () => {
    expect(confirmAt(order("ready", "2026-10-15T20:39:00Z", "2026-10-15T20:30:00Z"), cfg)).toBe(at("2026-10-15T20:42:00Z"));
  });
  it("S2 never asks while the kitchen has not finished, however long ago the order was placed (#456)", () => {
    for (const s of ["placed", "accepted", "preparing"]) expect(confirmAt(order(s, "2026-10-15T20:31:00Z", "2026-10-15T20:00:00Z"), cfg)).toBeNull();
  });
  it("an order out for delivery is asked 3 minutes after it left (#456)", () => {
    expect(confirmAt(order("out_for_delivery", "2026-10-15T20:40:00Z", "2026-10-15T20:30:00Z"), cfg)).toBe(at("2026-10-15T20:43:00Z"));
  });
  it("a delivered order is never asked", () => {
    expect(confirmAt(order("delivered"), cfg)).toBeNull();
  });
});

describe("Not yet (S5)", () => {
  it("asks again after 2 minutes, twice; the third Not yet opens the Feedback sheet", () => {
    const now = 1_000;
    expect(REASK_MS).toBe(2 * 60_000);
    expect(notYet(1, now)).toEqual({ feedback: false, askAgainAt: now + REASK_MS });
    expect(notYet(2, now)).toEqual({ feedback: false, askAgainAt: now + REASK_MS });
    expect(notYet(3, now)).toEqual({ feedback: true, askAgainAt: null });
  });
});

// Story #501: the question is asked only to someone who can answer it, about an order the server still holds as open.
describe("mayAsk", () => {
  it("never asks while the app is hidden (order 1a6e8df7 asked at 04:49:32 with the app hidden)", () => {
    expect(mayAsk(false, "out_for_delivery")).toBe(false);
    expect(mayAsk(false, null)).toBe(false);
  });
  it("never asks once the server says delivered or cancelled, whatever the app remembers", () => {
    expect(mayAsk(true, "delivered")).toBe(false);
    expect(mayAsk(true, "cancelled")).toBe(false);
  });
  it("asks when the app is visible and the server still holds the order as open; a read that failed does not block it", () => {
    for (const st of ["ready", "out_for_delivery", "preparing", null]) expect(mayAsk(true, st)).toBe(true);
  });
});
