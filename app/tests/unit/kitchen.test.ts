// Story #49: the kitchen list and its next-step buttons. Pure data in, pure data out.
import { describe, expect, it } from "vitest";
import { kitchenOrders, mergeOrder, nextStep, shortId, statusLabel, type Order, newTickets, cookingTickets, readyTickets, deliveredToday, outsideHours, staffLabel } from "../../src/lib/kitchen";

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
  it("compares moments, not text: the same instant written two ways is not newer", () => {
    const fresh = o("a", "preparing", "2020-01-01T10:00:00Z", "2020-01-01T10:03:00Z");
    const sameInstant = o("a", "accepted", "2020-01-01T10:00:00Z", "2020-01-01T10:03:00+00:00");
    expect(mergeOrder([fresh], sameInstant)[0].status).toBe("accepted");   // equal instants: the incoming copy wins
    const older = o("a", "placed", "2020-01-01T10:00:00Z", "2020-01-01T10:02:59.999+00:00");
    expect(mergeOrder([fresh], older)[0].status).toBe("preparing");
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
    expect([statusLabel("placed"), statusLabel("accepted"), statusLabel("preparing"), statusLabel("ready")]).toEqual(["Placed", "Accepted", "Cooking", "Ready"]);
  });
});

// ---- Story #50: rider steps and the customer tracker ----
import { riderActions, riderOrders, trackerSteps } from "../../src/lib/kitchen";

describe("rider steps", () => {
  it("S1 a ready order can be picked up; an order on the road can be marked arriving or delivered", () => {
    expect(riderActions("ready")).toEqual([{ kind: "status", to: "out_for_delivery", label: "Pick up" }]);
    expect(riderActions("out_for_delivery")).toEqual([
      { kind: "event", event: "order.arriving", label: "Arriving" },
      { kind: "status", to: "delivered", label: "Delivered" },
      { kind: "refused", label: "Not delivered" },   // story H14
    ]);
  });
  it("the rider has no button before Ready or after Delivered", () => {
    for (const s of ["placed", "accepted", "preparing", "delivered", "nonsense"]) expect(riderActions(s)).toEqual([]);
  });
  it("the rider list holds orders that are ready or on the road", () => {
    const list = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered"].map((s, i) => o("o" + i, s, "2020-01-01T10:0" + i + ":00Z"));
    expect(riderOrders(list).map((x) => x.status).sort()).toEqual(["out_for_delivery", "ready"]);
  });
});

describe("customer tracker", () => {
  it("S2 shows all six steps in order, with what is done, current and still to come", () => {
    const steps = trackerSteps("preparing");
    expect(steps.map((s) => s.label)).toEqual(["Placed", "Accepted", "Cooking", "Ready", "On the way", "Delivered"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "todo", "todo", "todo"]);
  });
  it("S2 ends at Delivered: every step done, the last one current", () => {
    expect(trackerSteps("delivered").map((s) => s.state)).toEqual(["done", "done", "done", "done", "done", "current"]);
  });
  it("an unknown status shows nothing done", () => {
    expect(trackerSteps("nonsense").every((s) => s.state === "todo")).toBe(true);
  });
  it("one label map for the kitchen and the customer", () => {
    expect([statusLabel("placed"), statusLabel("out_for_delivery"), statusLabel("delivered")]).toEqual(["Placed", "On the way", "Delivered"]);
  });
});

describe("H11 kitchen tabs", () => {
  const o = (status: string, created_at: string) => ({ id: created_at, session_id: "s", status, address: "", items: [], total_paise: 100, created_at, updated_at: created_at });
  it("new, cooking and ready tickets come oldest first", () => {
    const rows = [o("placed", "2026-10-24T10:05:00Z"), o("placed", "2026-10-24T10:01:00Z"), o("preparing", "2026-10-24T10:02:00Z"), o("accepted", "2026-10-24T10:00:00Z"), o("ready", "2026-10-24T09:59:00Z"), o("delivered", "2026-10-24T09:00:00Z")];
    expect(newTickets(rows).map((r) => r.created_at)).toEqual(["2026-10-24T10:01:00Z", "2026-10-24T10:05:00Z"]);
    expect(cookingTickets(rows).map((r) => r.created_at)).toEqual(["2026-10-24T10:00:00Z", "2026-10-24T10:02:00Z"]);
    expect(readyTickets(rows)).toHaveLength(1);
  });
  it("deliveredToday keeps only today's delivered orders, newest first", () => {
    const now = new Date("2026-10-24T20:00:00");
    const rows = [{ status: "delivered", updated_at: "2026-10-24T18:00:00", total_paise: 1 }, { status: "delivered", updated_at: "2026-10-24T19:00:00", total_paise: 2 }, { status: "delivered", updated_at: "2026-10-23T19:00:00", total_paise: 3 }, { status: "ready", updated_at: "2026-10-24T19:30:00", total_paise: 4 }];
    expect(deliveredToday(rows, now).map((r) => r.total_paise)).toEqual([2, 1]);
  });
});

it("the rider's jobs come oldest first: the one waiting longest is in hand", () => {
  const o = (status: string, created_at: string) => ({ id: created_at, session_id: "s", status, address: "", items: [], total_paise: 1, created_at, updated_at: created_at });
  expect(riderOrders([o("ready", "2026-10-24T10:10:00Z"), o("out_for_delivery", "2026-10-24T10:00:00Z"), o("placed", "2026-10-24T09:00:00Z")]).map((r) => r.created_at)).toEqual(["2026-10-24T10:00:00Z", "2026-10-24T10:10:00Z"]);
});

it("outsideHours handles a kitchen that closes after midnight", () => {
  expect(outsideHours("10:00", "22:00", "23:00")).toBe(true);
  expect(outsideHours("10:00", "22:00", "12:00")).toBe(false);
  expect(outsideHours("18:00", "02:00", "01:00")).toBe(false);   // open across midnight
  expect(outsideHours("18:00", "02:00", "03:00")).toBe(true);
  expect(outsideHours("18:00", "02:00", "17:00")).toBe(true);
  expect(outsideHours(null, "02:00", "03:00")).toBe(false);
});

it("staffLabel says New for a placed order and the usual word otherwise", () => {
  expect(staffLabel("placed")).toBe("New");
  expect(staffLabel("preparing")).toBe("Cooking");
});

// Story #229: the cash day ends at the kitchen's closing time, not at midnight.
import { dayOf } from "../../src/lib/kitchen";
describe("dayOf and deliveredToday across closing time", () => {
  const night = { opens: "18:00", closes: "02:00" };
  const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
  it("a kitchen that closes past midnight keeps 23:30 and 00:10 in one day", () => {
    expect(dayOf(t(23, 23, 30), night)).toBe(dayOf(t(24, 0, 10), night));
    expect(dayOf(t(24, 1, 59), night)).toBe(dayOf(t(23, 19), night));
    expect(dayOf(t(24, 2, 0), night)).not.toBe(dayOf(t(23, 19), night));   // 02:00 starts the next day
  });
  it("a kitchen that closes before midnight, or with no hours, uses the calendar day", () => {
    expect(dayOf(t(23, 23, 30), { opens: "10:00", closes: "23:00" })).not.toBe(dayOf(t(24, 0, 10), { opens: "10:00", closes: "23:00" }));
    expect(dayOf(t(23, 23, 30), null)).not.toBe(dayOf(t(24, 0, 10), null));
  });
  it("deliveredToday follows the kitchen's day", () => {
    const o = { status: "delivered", updated_at: t(23, 23, 30), total_paise: 100 };
    expect(deliveredToday([o], new Date(t(24, 0, 10)), night)).toHaveLength(1);
    expect(deliveredToday([o], new Date(t(24, 0, 10)))).toHaveLength(0);
  });
});
