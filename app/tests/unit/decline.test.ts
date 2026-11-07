// Story #934: the app enforces the 20-character reason before anything is sent; the server only needs it non-empty.
import { describe, expect, it, vi } from "vitest";
import { declineOrder } from "../../src/lib/orders";
import { isDeclined } from "../../src/lib/kitchen";

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
describe("isDeclined", () => {
  it("is the kitchen's words only", () => {
    expect(isDeclined({ status: "cancelled", cancel_reason: "We are out." })).toBe(true);
    expect(isDeclined({ status: "cancelled", cancel_reason: null })).toBe(false);
    expect(isDeclined({ status: "cancelled", cancel_reason: "refused_at_door" })).toBe(false);
    expect(isDeclined({ status: "placed", cancel_reason: "x" })).toBe(false);
  });
});
