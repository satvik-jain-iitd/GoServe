// Story D2 (#161): finding a dish. Categories as chips, a veg toggle and a search box work on the menu already loaded.
import { describe, it, expect } from "vitest";
import { categoriesOf, categoryKey, filterDishes, openTill } from "../../src/lib/browse";
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

// Story #972: the filter sheet has a checkbox per category. Tick any number: only dishes of the ticked categories show; none ticked is all.
describe("filterDishes with categories (story 972)", () => {
  const M = [
    { id: "1", name: "Dal Makhani", price_paise: 100, category: "Mains", veg: true }, { id: "2", name: "Butter Chicken", price_paise: 100, category: "mains", veg: false },
    { id: "3", name: "Tandoori Roti", price_paise: 100, category: "Breads", veg: true }, { id: "4", name: "Keema Naan", price_paise: 100, category: "Breads", veg: false },
    { id: "5", name: "Jeera Rice", price_paise: 100, category: "Rice", veg: true }, { id: "6", name: "House special", price_paise: 100, veg: true },
  ] as Dish[];
  it("ticking one category shows only its dishes (a case difference in the data does not split a category)", () => {
    expect(filterDishes(M, { categories: ["mains"] }).map((x) => x.id)).toEqual(["1", "2"]);
    expect(filterDishes(M, { categories: ["breads"] }).map((x) => x.id)).toEqual(["3", "4"]);
  });
  it("ticking two categories shows both", () => {
    expect(filterDishes(M, { categories: ["breads", "rice"] }).map((x) => x.id)).toEqual(["3", "4", "5"]);
  });
  it("none ticked, or an empty list, is the whole menu", () => {
    expect(filterDishes(M, { categories: [] })).toHaveLength(6);
    expect(filterDishes(M, {})).toHaveLength(6);
  });
  it("a dish with no category belongs to the Menu group", () => {
    expect(filterDishes(M, { categories: ["menu"] }).map((x) => x.id)).toEqual(["6"]);
    expect(categoryKey(M[5])).toBe("menu");
  });
  it("veg only with Breads shows only the veg breads, and the search word narrows it further", () => {
    expect(filterDishes(M, { categories: ["breads"], vegOnly: true }).map((x) => x.id)).toEqual(["3"]);
    expect(filterDishes(M, { categories: ["breads", "mains"], query: "naan" }).map((x) => x.id)).toEqual(["4"]);
  });
});
