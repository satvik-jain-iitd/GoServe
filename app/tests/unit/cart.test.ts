// Story #48, S1: the bill shows the right total. The cart is plain data; the server checks the price again (place_order).
import { describe, expect, it } from "vitest";
import { addDish, cartLines, cartTotal, changeQty, MAX_QTY, toOrderItems } from "../../src/lib/cart";
import { formatRupees } from "../../src/lib/money";

const menu = [
  { id: "a", name: "Butter Chicken", price_paise: 32000, image_url: "u", image_credit: "c" },
  { id: "b", name: "Samosa (2 pieces)", price_paise: 6050, image_url: "u", image_credit: "c" },
];

describe("cart", () => {
  it("adds a dish and counts it again on a second tap", () => {
    expect(addDish({}, "a")).toEqual({ a: 1 });
    expect(addDish({ a: 1 }, "a")).toEqual({ a: 2 });
  });

  it("changes quantity, and removes a dish that reaches 0", () => {
    expect(changeQty({ a: 2 }, "a", +1)).toEqual({ a: 3 });
    expect(changeQty({ a: 1 }, "a", -1)).toEqual({});
    expect(changeQty({}, "a", -1)).toEqual({});
  });

  it("never goes above the server limit of 20 a dish", () => {
    expect(MAX_QTY).toBe(20);
    expect(addDish({ a: 20 }, "a")).toEqual({ a: 20 });
    expect(changeQty({ a: 20 }, "a", +1)).toEqual({ a: 20 });
  });

  it("does not mutate the cart it is given", () => {
    const c = { a: 1 };
    addDish(c, "b");
    expect(c).toEqual({ a: 1 });
  });

  it("builds lines in menu order with the price of each line", () => {
    const lines = cartLines({ b: 2, a: 1 }, menu);
    expect(lines.map((l) => [l.dish.id, l.qty, l.line_paise])).toEqual([["a", 1, 32000], ["b", 2, 12100]]);
  });

  it("ignores a dish that is no longer on the menu", () => {
    expect(cartLines({ gone: 3, a: 1 }, menu).map((l) => l.dish.id)).toEqual(["a"]);
  });

  it("the total is the sum of the lines (2 dishes: 320 + 2 x 60.50 = 441)", () => {
    expect(cartTotal(cartLines({ a: 1, b: 2 }, menu))).toBe(44100);
    expect(cartTotal([])).toBe(0);
  });

  it("sends the server only dish ids and quantities, never a price", () => {
    expect(toOrderItems({ a: 1, b: 2 })).toEqual([{ menu_item_id: "a", qty: 1 }, { menu_item_id: "b", qty: 2 }]);
  });
});

describe("money", () => {
  it("shows rupees from paise, without .00 for whole rupees", () => {
    expect(formatRupees(32000)).toBe("₹320");
    expect(formatRupees(6050)).toBe("₹60.50");
    expect(formatRupees(0)).toBe("₹0");
  });
});
