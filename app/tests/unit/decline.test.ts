// Story #934: the app enforces the 20-character reason before anything is sent; the server only needs it non-empty.
import { describe, expect, it, vi } from "vitest";
import { declineOrder } from "../../src/lib/orders";
import { cancelKind } from "../../src/lib/kitchen";

const deps = (fetchFn: typeof fetch) => ({ fetchFn, token: async () => "t", url: "https://x.test", anon: "a" });

describe("declineOrder", () => {
  it("refuses a short reason without a network call", async () => {
    const f = vi.fn();
    await expect(declineOrder({ orderId: "o", reason: "too busy now" }, deps(f as unknown as typeof fetch))).rejects.toMatchObject({ code: "reason_short" });
    expect(f).not.toHaveBeenCalled();
  });
  it("sends the trimmed reason as a cancel", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, order: { id: "o", status: "cancelled", updated_at: "u" } }), { status: 200 }));
    await declineOrder({ orderId: "o", reason: "  We are out of paneer tonight.  " }, deps(f as unknown as typeof fetch));
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ order_id: "o", action: "cancel", reason: "We are out of paneer tonight." });
  });
});
// Story #1017: who cancelled is a recorded fact (orders.cancelled_by), not a guess from the reason text.
describe("cancelKind", () => {
  const c = (over: object) => ({ status: "cancelled", ...over });
  it("a customer's own cancel is customer, with or without any reason text", () => {
    expect(cancelKind(c({ cancelled_by: "customer", cancel_reason: null }))).toBe("customer");
    expect(cancelKind(c({ cancelled_by: "customer", cancel_reason: "cancelled by customer" }))).toBe("customer");
  });
  it("the kitchen or an admin is a decline, in the kitchen's words", () => {
    expect(cancelKind(c({ cancelled_by: "kitchen", cancel_reason: "We are out." }))).toBe("declined");
    expect(cancelKind(c({ cancelled_by: "admin", cancel_reason: "Closed today." }))).toBe("declined");
  });
  it("the rider's refusal at the door is rider", () => {
    expect(cancelKind(c({ cancelled_by: "rider", cancel_reason: "refused_at_door" }))).toBe("rider");
  });
  it("an old row with no cancelled_by reads from its text: the old customer text is customer, a code is rider, words are a decline, none is customer", () => {
    expect(cancelKind(c({ cancel_reason: "cancelled by customer" }))).toBe("customer");
    expect(cancelKind(c({ cancel_reason: "refused_at_door" }))).toBe("rider");
    expect(cancelKind(c({ cancel_reason: "We are out." }))).toBe("declined");
    expect(cancelKind(c({ cancel_reason: null }))).toBe("customer");
  });
  it("an order that is not cancelled has none", () => {
    expect(cancelKind({ status: "placed", cancelled_by: "customer" })).toBeNull();
  });
});
