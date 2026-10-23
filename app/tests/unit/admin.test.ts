// Story A2 (#149): the admin screen's input rules.
import { describe, expect, it } from "vitest";
import { parsePins } from "../../src/lib/admin";

describe("parsePins", () => {
  it("reads pin codes separated by commas or spaces and drops repeats", () => {
    expect(parsePins("110016, 110017 110016")).toEqual({ pins: ["110016", "110017"], bad: [] });
  });
  it("names every entry that is not six digits", () => {
    expect(parsePins("1100, abc, 110016")).toEqual({ pins: ["110016"], bad: ["1100", "abc"] });
  });
  it("an empty field is no pin codes", () => {
    expect(parsePins("  ")).toEqual({ pins: [], bad: [] });
  });
});

import { photoPath, photoProblem, rupeesToPaise } from "../../src/lib/admin";

describe("rupeesToPaise (story A3)", () => {
  it("turns rupees into paise", () => {
    expect(rupeesToPaise("320")).toBe(32000);
    expect(rupeesToPaise("60.50")).toBe(6050);
    expect(rupeesToPaise(" 8 ")).toBe(800);
  });
  it("refuses empty, negative, zero, text and more than two decimals", () => {
    for (const bad of ["", "-5", "0", "abc", "1.234", "1,5"]) expect(rupeesToPaise(bad), bad).toBeNull();
  });
});

describe("photoProblem", () => {
  it("accepts a picture up to 3 MB", () => {
    expect(photoProblem({ type: "image/jpeg", size: 3 * 1024 * 1024 })).toBeNull();
  });
  it("refuses a file that is not a picture, or is too big", () => {
    expect(photoProblem({ type: "application/pdf", size: 10 })).toMatch(/picture/);
    expect(photoProblem({ type: "image/png", size: 3 * 1024 * 1024 + 1 })).toMatch(/3 MB/);
  });
});

describe("photoPath", () => {
  it("keeps the photo under its kitchen with a safe name", () => {
    expect(photoPath("k-1", "My Dish (1).JPG", "abc")).toBe("k-1/abc.jpg");
    expect(photoPath("k-1", "noext", "abc")).toBe("k-1/abc.jpg");
  });
});

import { filterAdminOrders, istDayStart, sumNumbers, type AdminOrder, type DayNumbers } from "../../src/lib/admin";

describe("istDayStart (story A4)", () => {
  it("is midnight in India, as a UTC moment", () => {
    expect(istDayStart(new Date("2026-10-23T10:00:00Z"))).toBe("2026-10-22T18:30:00.000Z");
    expect(istDayStart(new Date("2026-10-23T19:00:00Z"))).toBe("2026-10-23T18:30:00.000Z");   // 00:30 on 24 Oct in India
  });
});

const ord = (id: string, kitchen_id: string, status: string): AdminOrder => ({ id, kitchen_id, status, created_at: "2026-10-23T10:00:00Z", total_paise: 100, items: [], address: "a", customer_name: null, customer_phone: null, cancel_reason: null });
describe("filterAdminOrders", () => {
  const list = [ord("a", "k1", "placed"), ord("b", "k2", "delivered"), ord("c", "k1", "cancelled")];
  it("keeps all when no filter is set", () => {
    expect(filterAdminOrders(list, "", "").map((o) => o.id)).toEqual(["a", "b", "c"]);
  });
  it("filters by kitchen and by status", () => {
    expect(filterAdminOrders(list, "k1", "").map((o) => o.id)).toEqual(["a", "c"]);
    expect(filterAdminOrders(list, "", "delivered").map((o) => o.id)).toEqual(["b"]);
    expect(filterAdminOrders(list, "k1", "cancelled").map((o) => o.id)).toEqual(["c"]);
  });
});

describe("sumNumbers", () => {
  const row = (kitchen_name: string, orders: number, delivered: number, cancelled: number, cash_paise: number): DayNumbers => ({ kitchen_id: kitchen_name, kitchen_name, orders, delivered, cancelled, cash_paise });
  it("adds the kitchens into one day total", () => {
    expect(sumNumbers([row("A", 5, 3, 1, 90000), row("B", 2, 2, 0, 40000)])).toEqual({ orders: 7, delivered: 5, cancelled: 1, cash_paise: 130000 });
  });
  it("is all zeros for no kitchens", () => {
    expect(sumNumbers([])).toEqual({ orders: 0, delivered: 0, cancelled: 0, cash_paise: 0 });
  });
});
