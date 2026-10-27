// Story #601: an equal-timestamp live event with paid_by null must not clear the cash the Yes answer set (night run 2 of the rehearsal, order dcc0a6e7).
import { describe, it, expect } from "vitest";
import { mergeOrder } from "../../src/lib/kitchen";
const t = "2026-10-27T17:33:02.785Z";
const base: any = { id: "dcc0a6e7", created_at: "2026-10-27T17:25:09Z", updated_at: t, status: "delivered", paid_by: "cash" };
describe("mergeOrder with equal updated_at", () => {
  it("an equal-timestamp event with paid_by null clears the cash (the run 2 symptom)", () => {
    const after = mergeOrder([base], { ...base, status: "delivered", paid_by: null });
    expect(after[0].paid_by).toBe("cash");   // what the phone must keep
  });
  it("a later copy may still change the paid_by (a refund is not this case): a newer row with another value wins", () => {
    const after = mergeOrder([base], { ...base, updated_at: "2026-10-27T17:34:00Z", paid_by: "online" });
    expect(after[0].paid_by).toBe("online");
  });
  it("an order that never had a paid_by stays null", () => {
    const open = { ...base, paid_by: null };
    expect(mergeOrder([open], { ...open })[0].paid_by).toBeNull();
  });
});
