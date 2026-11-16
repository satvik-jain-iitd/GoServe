// Story #977: Order again builds a cart from an old order, at today's menu.
import { describe, it, expect } from "vitest";
import { reorderCart } from "../../src/lib/cart";
import type { Dish } from "../../src/lib/menu";

const d = (id: string, name: string, over: Partial<Dish> = {}): Dish => ({ id, name, price_paise: 10000, image_url: null, image_credit: null, ...over });
const line = (menu_item_id: string, name: string, qty: number) => ({ menu_item_id, name, qty, price_paise: 5000 });

describe("reorderCart", () => {
  it("copies dishes and quantities that are on today's menu", () => {
    const r = reorderCart([line("a", "Veg Thali", 1), line("b", "Roti", 2)], [d("a", "Veg Thali"), d("b", "Roti")]);
    expect(r.cart).toEqual({ a: 1, b: 2 });
    expect(r.left).toEqual([]);
  });
  it("leaves out a dish that is sold out and names it", () => {
    const r = reorderCart([line("a", "Veg Thali", 1), line("b", "Roti", 2)], [d("a", "Veg Thali"), d("b", "Roti", { available: false })]);
    expect(r.cart).toEqual({ a: 1 });
    expect(r.left).toEqual(["Roti"]);
  });
  it("leaves out a dish that is gone from the menu", () => {
    const r = reorderCart([line("a", "Veg Thali", 1), line("z", "Old Dish", 3)], [d("a", "Veg Thali")]);
    expect(r.cart).toEqual({ a: 1 });
    expect(r.left).toEqual(["Old Dish"]);
  });
  it("keeps a quantity inside the limit", () => {
    expect(reorderCart([line("a", "Roti", 99)], [d("a", "Roti")]).cart).toEqual({ a: 20 });
  });
});

// Story 1589: an order of another kitchen has dish ids that today's menu does not hold; the match is the story 1540 rule (name, same veg mark), the marks are read once.
describe("reorderCart across kitchens", () => {
  const old = (id: string, name: string, qty = 1) => ({ menu_item_id: id, name, qty, price_paise: 5000 });
  it("matches an unknown id by name and veg mark, and says it moved", () => {
    const r = reorderCart([old("x1", "Veg Thali", 2)], [d("a", "Veg Thali", { veg: true })], { x1: true });
    expect(r.cart).toEqual({ a: 2 });
    expect(r.moved).toBe(true);
  });
  it("does not match a dish of the same name with another veg mark", () => {
    const r = reorderCart([old("x1", "Veg Thali")], [d("a", "Veg Thali", { veg: false })], { x1: true });
    expect(r.cart).toEqual({});
    expect(r.left).toEqual(["Veg Thali"]);
  });
  it("an old dish with no mark read has no match", () => {
    expect(reorderCart([old("x1", "Veg Thali")], [d("a", "Veg Thali")], {}).left).toEqual(["Veg Thali"]);
  });
  it("two dishes of one name today: no match, never a guess", () => {
    expect(reorderCart([old("x1", "Roti")], [d("a", "Roti", { veg: true }), d("b", "Roti", { veg: true })], { x1: true }).left).toEqual(["Roti"]);
  });
  it("a same-id dish is not moved", () => {
    expect(reorderCart([old("a", "Roti")], [d("a", "Roti")]).moved).toBe(false);
  });
});
