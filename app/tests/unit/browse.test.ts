// Story D2 (#161): finding a dish. Categories as chips, a veg toggle and a search box work on the menu already loaded.
import { describe, it, expect } from "vitest";
import { categoriesOf, filterDishes, openTill } from "../../src/lib/browse";
import type { Dish } from "../../src/lib/menu";

const d = (id: string, name: string, over: Partial<Dish> = {}): Dish => ({ id, name, price_paise: 10000, image_url: null, image_credit: null, ...over });
const MENU = [d("1", "Dal Makhani", { category: "Main", veg: true }), d("2", "Butter Chicken", { category: "Main", veg: false }), d("3", "Gulab Jamun", { category: "Sweet", veg: true }), d("4", "Water")];

describe("browse", () => {
  it("S1 categories are the distinct names in menu order, dishes without one add none", () => {
    expect(categoriesOf(MENU)).toEqual(["Main", "Sweet"]);
  });
  it("S1 a category keeps only its dishes", () => {
    expect(filterDishes(MENU, { category: "Sweet" }).map((x) => x.id)).toEqual(["3"]);
  });
  it("S1 veg only hides non-veg; a dish with no veg flag counts as veg", () => {
    expect(filterDishes(MENU, { vegOnly: true }).map((x) => x.id)).toEqual(["1", "3", "4"]);
  });
  it("S1 search ignores case and spaces at the ends", () => {
    expect(filterDishes(MENU, { query: "  BUTTER " }).map((x) => x.id)).toEqual(["2"]);
  });
  it("S1 the filters work together; no filter keeps everything", () => {
    expect(filterDishes(MENU, { category: "Main", vegOnly: true, query: "dal" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterDishes(MENU, {})).toHaveLength(4);
  });
  it("S2 'open till' reads the closing time as 12 hour clock, or says nothing", () => {
    expect(openTill("22:00:00")).toBe("Open till 10:00 pm");
    expect(openTill("00:30:00")).toBe("Open till 12:30 am");
    expect(openTill(null)).toBe("");
    expect(openTill(undefined)).toBe("");
  });
});
