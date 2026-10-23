// Story B3 (#159): the customer's saved details, the delivery estimate, and the rules that keep a cancelled order out of the way.
import { describe, expect, it } from "vitest";
import { etaMinutes, isPhone, orderSummary } from "../../src/lib/profile";
import { kitchenOrders, riderOrders, statusLabel, trackerSteps, type Order } from "../../src/lib/kitchen";
import { openOrderToResume } from "../../src/lib/resume";
import { loadDraft, saveDraft } from "../../src/lib/draft";

const o = (id: string, status: string): Order => ({ id, status, created_at: "2026-10-23T10:00:00Z", updated_at: "2026-10-23T10:00:00Z", session_id: "s", address: "a", total_paise: 38050, items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 2, price_paise: 100 }, { menu_item_id: "d2", name: "Samosa", qty: 1, price_paise: 50 }] });

describe("isPhone", () => {
  it("is ten digits", () => {
    expect(isPhone("9876543210")).toBe(true);
    for (const bad of ["", "98765", "98765432101", "98765 43210", "abcdefghij"]) expect(isPhone(bad), bad).toBe(false);
  });
});

describe("etaMinutes", () => {
  it("is 15 minutes of cooking plus 1.5 minutes a km, and never under 20", () => {
    expect(etaMinutes(10)).toBe(30);
    expect(etaMinutes(2)).toBe(20);
  });
  it("is the minimum, 20, while the distance is not known", () => {
    expect(etaMinutes()).toBe(20);
  });
});

describe("orderSummary", () => {
  it("says what was ordered, without any order id", () => {
    expect(orderSummary(o("0f0f0f0f-1111", "delivered"))).toBe("2 × Butter Chicken, 1 × Samosa");
  });
});

describe("a cancelled order", () => {
  it("has its own label, an empty tracker, and no place on the kitchen or rider screen", () => {
    expect(statusLabel("cancelled")).toBe("Cancelled");
    expect(trackerSteps("cancelled").every((s) => s.state === "todo")).toBe(true);
    expect(kitchenOrders([o("a", "cancelled"), o("b", "placed")]).map((x) => x.id)).toEqual(["b"]);
    expect(riderOrders([o("a", "cancelled"), o("b", "ready")]).map((x) => x.id)).toEqual(["b"]);
  });
  it("is not resumed after a refresh", () => {
    expect(openOrderToResume([o("a", "cancelled")])).toBeNull();
  });
});

describe("draft keeps the name and the phone too", () => {
  it("round trip", () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
    saveDraft({ step: "cart", cart: { d1: 1 }, address: "Flat 4", name: "Asha", phone: "9876543210" }, s);
    expect(loadDraft(s)).toEqual({ step: "cart", cart: { d1: 1 }, address: "Flat 4", name: "Asha", phone: "9876543210" });
  });
});
