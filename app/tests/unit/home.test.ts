// Story H10b (#193): the thali hero and the menu sections.
import { describe, expect, it } from "vitest";
import { sectionsOf, thalisOf } from "../../src/lib/home";
import type { Dish } from "../../src/lib/menu";

const d = (id: string, category: string | null, veg = true): Dish => ({ id, name: id, price_paise: 100, image_url: null, image_credit: null, veg, category });

describe("thalisOf", () => {
  it("finds the veg and the non-veg thali by category, and none when there is no thali", () => {
    const t = thalisOf([d("a", "Main"), d("v", "Thali"), d("n", "thali", false)]);
    expect([t.veg?.id, t.nonveg?.id]).toEqual(["v", "n"]);
    expect(thalisOf([d("a", "Main")])).toEqual({ veg: undefined, nonveg: undefined });
  });
});
describe("sectionsOf", () => {
  it("groups by category in menu order, leaves the thali out, and names a missing category Menu", () => {
    const s = sectionsOf([d("a", "main"), d("b", "Bread"), d("c", "main"), d("t", "Thali"), d("x", null)]);
    expect(s.map((x) => [x.title, x.dishes.map((y) => y.id)])).toEqual([["Main", ["a", "c"]], ["Bread", ["b"]], ["Menu", ["x"]]]);
  });
});
