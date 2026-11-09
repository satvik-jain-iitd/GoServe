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
