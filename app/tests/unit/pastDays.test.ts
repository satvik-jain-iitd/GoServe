// Story 1442: the past days list and the older cash line, from the rider's own delivered orders.
import { describe, expect, it } from "vitest";
import { cashByRider } from "../../src/lib/kitchen";
import { dayName, olderDue, pastDays } from "../../src/lib/pastDays";

const at = (d: number, h: number) => new Date(2026, 10, d, h, 0, 0).toISOString();
const o = (id: string, d: number, h: number, paid: string, paise: number, handed: boolean) =>
  ({ id, status: "delivered", updated_at: at(d, h), delivered_at: at(d, h), rider_id: "r1", paid_by: paid, total_paise: paise, cash_handed_at: handed ? at(d, 23) : null });
const ORDERS = [o("a", 11, 13, "cash", 30000, true), o("b", 12, 13, "cash", 42000, false), o("c", 12, 19, "upi_door", 31000, false), o("d", 14, 12, "cash", 34000, false)];
const NOW = new Date(2026, 10, 14, 15, 0, 0);

describe("pastDays", () => {
  it("lists only earlier days that had a delivery, newest first, with the cash and what is still due", () => {
    const days = pastDays(ORDERS, 7, NOW);
    expect(days.map((d) => dayName(d.date))).toEqual(["Thu, 12 Nov", "Wed, 11 Nov"]);
    expect(days[0]).toMatchObject({ cash: 42000, due: 42000 });
    expect(days[0].orders.map((x) => x.id)).toEqual(["c", "b"]);
    expect(days[1]).toMatchObject({ cash: 30000, due: 0 });
  });
  it("keeps only the last n days, and 0 gives none", () => {
    expect(pastDays(ORDERS, 2, NOW).map((d) => d.orders.length)).toEqual([2]);
    expect(pastDays(ORDERS, 0, NOW)).toEqual([]);
  });
});

describe("olderDue", () => {
  it("is the kitchen's older number for the same rider, from the first day still due", () => {
    const due = olderDue(ORDERS, NOW);
    expect(due.paise).toBe(42000);
    expect(due.from?.getDate()).toBe(12);
    const today = ORDERS.filter((x) => x.id === "d");
    expect(cashByRider(today, ORDERS)[0].older).toBe(due.paise);
  });
  it("is nothing when every older cash was handed over", () => {
    expect(olderDue(ORDERS.filter((x) => x.id !== "b"), NOW)).toEqual({ paise: 0, from: null });
  });
});
