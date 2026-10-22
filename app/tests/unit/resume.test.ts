import { describe, expect, it } from "vitest";
import { openOrderToResume } from "../../src/lib/resume";
import type { Order } from "../../src/lib/kitchen";

const o = (id: string, status: string, created_at: string): Order => ({ id, session_id: "s", status, address: "a", items: [], total_paise: 9000, created_at, updated_at: created_at });

// Scenario: the customer refreshes the app after placing an order and lands back on the order screen.
describe("openOrderToResume", () => {
  it("returns the newest order that is not delivered", () => {
    const list = [o("a", "delivered", "2026-10-22T08:00:00Z"), o("b", "placed", "2026-10-22T09:00:00Z"), o("c", "accepted", "2026-10-22T08:30:00Z")];
    expect(openOrderToResume(list)?.id).toBe("b");
  });
  it("returns null when every order is delivered or there are none", () => {
    expect(openOrderToResume([o("a", "delivered", "2026-10-22T08:00:00Z")])).toBeNull();
    expect(openOrderToResume([])).toBeNull();
  });
});
