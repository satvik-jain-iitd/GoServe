// Story S-C (#95): when the app asks "Was your order delivered?", and what each answer does. Pure timing, no network.
import { describe, expect, it } from "vitest";
import { confirmAt, notYet, REASK_MS, type ConfirmCfg } from "../../src/lib/confirm";
import { confirmDelivery, placeOrder } from "../../src/lib/orders";

const cfg: ConfirmCfg = { afterReadyMin: 3, afterPlaceMin: 8 };
const at = (iso: string) => Date.parse(iso);
const order = (status: string, updated = "2026-10-15T20:40:00Z", created = "2026-10-15T20:30:00Z") => ({ status, created_at: created, updated_at: updated });

describe("confirmAt", () => {
  it("S1 asks 3 minutes after Ready", () => {
    expect(confirmAt(order("ready", "2026-10-15T20:40:00Z", "2026-10-15T20:38:00Z"), cfg)).toBe(at("2026-10-15T20:43:00Z"));
  });
  it("S1 never later than 8 minutes after the order was placed", () => {
    expect(confirmAt(order("ready", "2026-10-15T20:39:00Z", "2026-10-15T20:30:00Z"), cfg)).toBe(at("2026-10-15T20:38:00Z"));
  });
  it("S2 asks 8 minutes after placing when nobody touched the order, or the kitchen is still cooking", () => {
    for (const s of ["placed", "accepted", "preparing"]) expect(confirmAt(order(s), cfg)).toBe(at("2026-10-15T20:38:00Z"));
  });
  it("an order already out for delivery is asked 8 minutes after placing too", () => {
    expect(confirmAt(order("out_for_delivery"), cfg)).toBe(at("2026-10-15T20:38:00Z"));
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

describe("the calls", () => {
  const deps = (res: () => Promise<Response>, seen: { init?: RequestInit } = {}) => ({
    url: "https://n8n.test/webhook/gs-order", token: "demo-token", fetchFn: (async (_u: string, init: RequestInit) => { seen.init = init; return res(); }) as typeof fetch,
  });
  const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("place returns the two prompt times from the server, with 3 and 8 as the fallback", async () => {
    const o = { id: "o1", status: "placed", total_paise: 100, updated_at: "u" };
    const input = { sessionId: "s", key: "k", items: [], address: "a" };
    expect((await placeOrder(input, deps(json(201, { ok: true, created: true, order: o, confirm_after_ready_min: 1, confirm_after_place_min: 5 })))).confirm).toEqual({ afterReadyMin: 1, afterPlaceMin: 5 });
    expect((await placeOrder(input, deps(json(201, { ok: true, created: true, order: o })))).confirm).toEqual({ afterReadyMin: 3, afterPlaceMin: 8 });
  });
  it("S3 Yes posts the order and the session with the token and returns the closed order", async () => {
    const seen: { init?: RequestInit } = {};
    const order = { id: "o1", status: "delivered", total_paise: 100, updated_at: "u", paid_by: "cash" };
    const r = await confirmDelivery({ sessionId: "s1", orderId: "o1" }, deps(json(200, { ok: true, order }), seen));
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "confirm", session_id: "s1", order_id: "o1" });
    expect((seen.init?.headers as Record<string, string>)["x-gs-token"]).toBe("demo-token");
    expect(r).toEqual({ order, alreadyDone: false });
  });
  it("S4 a second Yes is not an error", async () => {
    const order = { id: "o1", status: "delivered", total_paise: 100, updated_at: "u", paid_by: "cash" };
    expect((await confirmDelivery({ sessionId: "s1", orderId: "o1" }, deps(json(200, { ok: true, already_done: true, order })))).alreadyDone).toBe(true);
  });
  it("an order that is not ready yet is a clear refusal", async () => {
    await expect(confirmDelivery({ sessionId: "s1", orderId: "o1" }, deps(json(409, { ok: false, error: "illegal_step", message: "That step is not allowed now." })))).rejects.toMatchObject({ code: "illegal_step" });
  });
});
