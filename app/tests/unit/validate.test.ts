// Story H1 (#184): the rules for a kitchen and a dish, checked in the admin app before any call. The database has the same rules (migration 0022).
import { describe, it, expect } from "vitest";
import { adminMessage } from "../../src/lib/admin";
import { dishProblem, kitchenProblem } from "../../src/lib/validate";

const GOOD = { name: "Tau Ka Dhaba", address: "12 Lajpat Nagar, Delhi", phone: "9876543210", pins: "110024, 110049", opensAt: "10:00", closesAt: "22:00" };

describe("kitchenProblem", () => {
  it("S1 a complete kitchen has no problem", () => expect(kitchenProblem(GOOD)).toBeNull());
  it("S1 at least one pin code is needed", () => expect(kitchenProblem({ ...GOOD, pins: "" })).toMatch(/pin code/i));
  it("S1 a bad pin code is named, and more than twenty are refused", () => {
    expect(kitchenProblem({ ...GOOD, pins: "1100" })).toContain("1100");
    expect(kitchenProblem({ ...GOOD, pins: Array.from({ length: 21 }, (_, i) => String(110000 + i)).join(",") })).toMatch(/20/);
  });
  it("S1 the phone is ten digits starting with 6 to 9", () => {
    for (const p of ["", "12345", "5876543210", "98765432101", "98765abcde"]) expect(kitchenProblem({ ...GOOD, phone: p }), p).toMatch(/phone/i);
  });
  it("S1 the name is 2 to 60 characters and the address 5 to 200", () => {
    expect(kitchenProblem({ ...GOOD, name: "A" })).toMatch(/name/i);
    expect(kitchenProblem({ ...GOOD, name: "x".repeat(61) })).toMatch(/name/i);
    expect(kitchenProblem({ ...GOOD, address: "ab" })).toMatch(/address/i);
    expect(kitchenProblem({ ...GOOD, address: "x".repeat(201) })).toMatch(/address/i);
  });
  it("S1 the opening and closing time must differ; one alone or none is fine; a late-night kitchen (22:00 to 02:00) is fine", () => {
    expect(kitchenProblem({ ...GOOD, opensAt: "10:00", closesAt: "10:00" })).toMatch(/time/i);
    expect(kitchenProblem({ ...GOOD, opensAt: "", closesAt: "" })).toBeNull();
    expect(kitchenProblem({ ...GOOD, opensAt: "22:00", closesAt: "02:00" })).toBeNull();
  });
});

describe("dishProblem", () => {
  const D = { name: "Dal Makhani", price: "220", category: "Main" };
  it("S2 a good dish has no problem", () => expect(dishProblem(D)).toBeNull());
  it("S2 the name is 2 to 60 characters", () => {
    expect(dishProblem({ ...D, name: "D" })).toMatch(/name/i);
    expect(dishProblem({ ...D, name: "x".repeat(61) })).toMatch(/name/i);
  });
  it("S2 the price is from ₹1 to ₹5,000 in rupees", () => {
    for (const p of ["", "abc", "0", "0.00", "5000.01", "-5"]) expect(dishProblem({ ...D, price: p }), p).toMatch(/price/i);
    expect(dishProblem({ ...D, price: "5000" })).toBeNull();
    expect(dishProblem({ ...D, price: "1" })).toBeNull();
  });
  it("S2 the category is 30 characters or fewer", () => expect(dishProblem({ ...D, category: "x".repeat(31) })).toMatch(/category/i));
});

describe("adminMessage for the database rules", () => {
  it("S3 a refused kitchen or dish says why in plain words", () => {
    expect(adminMessage({ message: 'violates check constraint "kitchens_pin_required"' })).toMatch(/pin code/i);
    expect(adminMessage({ message: 'violates check constraint "kitchens_phone_format"' })).toMatch(/phone/i);
    expect(adminMessage({ message: 'violates check constraint "kitchens_hours_differ"' })).toMatch(/time/i);
    expect(adminMessage({ message: 'duplicate key value violates unique constraint "kitchens_name_unique"' })).toMatch(/already/i);
    expect(adminMessage({ message: 'violates check constraint "menu_items_price_positive"' })).toMatch(/price/i);
    expect(adminMessage({ message: 'duplicate key value violates unique constraint "menu_items_name_unique"' })).toMatch(/already/i);
  });
});
