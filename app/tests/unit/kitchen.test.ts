// Story #49: the kitchen list and its next-step buttons. Pure data in, pure data out.
import { describe, expect, it } from "vitest";
import { kitchenOrders, mergeOrder, nextStep, shortId, statusLabel, type Order } from "../../src/lib/kitchen";

const o = (id: string, status: string, created_at: string, updated_at = created_at): Order => ({
  id, status, created_at, updated_at, session_id: "s1", address: "Flat 4", total_paise: 100, items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 100 }],
});

describe("nextStep", () => {
  it("S2 the three kitchen taps in order: Accept, Start, Ready", () => {
    expect(nextStep("placed")).toEqual({ to: "accepted", label: "Accept" });
    expect(nextStep("accepted")).toEqual({ to: "preparing", label: "Start" });
    expect(nextStep("preparing")).toEqual({ to: "ready", label: "Ready" });
  });
  it("after Ready the kitchen has no button: the rider takes over", () => {
    for (const s of ["ready", "out_for_delivery", "delivered", "nonsense"]) expect(nextStep(s)).toBeNull();
  });
});

describe("mergeOrder", () => {
  it("S1 adds a new order at the top, newest first", () => {
    const list = mergeOrder([o("a", "placed", "2026-10-14T10:00:00Z")], o("b", "placed", "2026-10-14T10:05:00Z"));
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("replaces an order with its new status", () => {
    const list = mergeOrder([o("a", "placed", "2026-10-14T10:00:00Z")], o("a", "accepted", "2026-10-14T10:00:00Z", "2026-10-14T10:01:00Z"));
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("accepted");
  });
  it("ignores an older copy that arrives late (live event after the tap answer)", () => {
    const fresh = o("a", "preparing", "2026-10-14T10:00:00Z", "2026-10-14T10:03:00Z");
    const list = mergeOrder([fresh], o("a", "accepted", "2026-10-14T10:00:00Z", "2026-10-14T10:01:00Z"));
    expect(list[0].status).toBe("preparing");
  });
  it("does not change the list it is given", () => {
    const base = [o("a", "placed", "2026-10-14T10:00:00Z")];
    mergeOrder(base, o("b", "placed", "2026-10-14T10:05:00Z"));
    expect(base).toHaveLength(1);
  });
});

describe("kitchenOrders and labels", () => {
  it("shows orders until the rider has them", () => {
    const list = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered"].map((s, i) => o("o" + i, s, "2026-10-14T10:0" + i + ":00Z"));
    expect(kitchenOrders(list).map((x) => x.status).sort()).toEqual(["accepted", "placed", "preparing", "ready"]);
  });
  it("the order number is the first 8 characters of the id", () => {
    expect(shortId("0f0f0f0f-1111-4222-8333-444444444444")).toBe("0f0f0f0f");
  });
  it("uses kitchen words for statuses", () => {
    expect([statusLabel("placed"), statusLabel("accepted"), statusLabel("preparing"), statusLabel("ready")]).toEqual(["New", "Accepted", "Cooking", "Ready"]);
  });
});
