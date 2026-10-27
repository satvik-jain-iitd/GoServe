// Story #343 (E27, plan v2 B.7). Scenario: Given a kitchen, when the menu is asked, then it returns categories and collections (Bestsellers, Under 99, New)
// and dish badges, sold-out and back-soon flags. The rules live in buildMenu (pure); the handler adds the HTTP part.
import { assertEquals } from "jsr:@std/assert@1";
import { buildMenu, type DishRow } from "./menu.ts";

const NOW = new Date("2026-10-27T10:00:00Z");
const row = (o: Partial<DishRow> & { id: string }): DishRow => ({
  name: o.id, price_paise: 12000, available: true, veg: true, category: "Thali", sort: 0, image_url: null, badge: null, size_tag: null,
  protein_g: null, back_soon_at: null, created_at: "2026-09-01T00:00:00Z", option_groups: [], ...o,
});

Deno.test("dishes are grouped by category in the order of sort, then name", () => {
  const m = buildMenu([row({ id: "b", category: "Thali", sort: 2 }), row({ id: "a", category: "Thali", sort: 1 }), row({ id: "c", category: "Drinks", sort: 3 })], NOW);
  assertEquals(m.categories.map((c) => [c.name, c.dishes.map((d) => d.id)]), [["Thali", ["a", "b"]], ["Drinks", ["c"]]]);
});

Deno.test("a dish with no category goes to Other, last", () => {
  const m = buildMenu([row({ id: "x", category: null }), row({ id: "y", category: "Thali", sort: 5 })], NOW);
  assertEquals(m.categories.map((c) => c.name), ["Thali", "Other"]);
});

Deno.test("collections: Bestsellers by badge, Under 99 by price, New by age; each lists dish ids; empty ones are left out", () => {
  const m = buildMenu([
    row({ id: "best", badge: "bestseller", price_paise: 18000 }),
    row({ id: "cheap", price_paise: 9900 }),
    row({ id: "dear", price_paise: 9901 }),
    row({ id: "fresh", created_at: "2026-10-20T00:00:00Z" }),
    row({ id: "old", created_at: "2026-10-01T00:00:00Z" }),
  ], NOW);
  assertEquals(m.collections.map((c) => [c.key, c.title, c.dish_ids]), [
    ["bestsellers", "Bestsellers", ["best"]],
    ["under_99", "Under 99", ["cheap"]],
    ["new", "New", ["fresh"]],
  ]);
  assertEquals(buildMenu([row({ id: "only", price_paise: 20000 })], NOW).collections, []);
});

Deno.test("a sold-out dish stays on the menu with sold_out true, and never in a collection", () => {
  const m = buildMenu([row({ id: "gone", available: false, badge: "bestseller", price_paise: 5000 })], NOW);
  const d = m.categories[0].dishes[0];
  assertEquals([d.id, d.sold_out, d.back_soon, d.back_soon_at], ["gone", true, false, null]);
  assertEquals(m.collections, []);
});

Deno.test("back soon: a sold-out dish with a back time in the future says so; a time in the past does not", () => {
  const m = buildMenu([row({ id: "soon", available: false, back_soon_at: "2026-10-27T12:00:00Z" }), row({ id: "late", available: false, back_soon_at: "2026-10-27T09:00:00Z" })], NOW);
  const byId = Object.fromEntries(m.categories[0].dishes.map((d) => [d.id, d]));
  assertEquals([byId.soon.back_soon, byId.soon.back_soon_at], [true, "2026-10-27T12:00:00.000Z"]);
  assertEquals([byId.late.back_soon, byId.late.back_soon_at], [false, null]);
});

Deno.test("a dish carries badge, size tag and protein, and nothing the app must not see", () => {
  const m = buildMenu([row({ id: "d", badge: "chef", size_tag: "large", protein_g: 24, image_url: "https://img/x.jpg" })], NOW);
  const d = m.categories[0].dishes[0];
  assertEquals([d.badge, d.size_tag, d.protein_g, d.image_url], ["chef", "large", 24, "https://img/x.jpg"]);
  assertEquals(Object.keys(d).sort(), ["back_soon", "back_soon_at", "badge", "category", "id", "image_url", "name", "option_groups", "price_paise", "protein_g", "size_tag", "sold_out", "veg"]);
});

Deno.test("add-on groups come with the dish, in sort order, with min, max and their options (sold out marked, nothing else leaks)", () => {
  const m = buildMenu([row({
    id: "thali",
    option_groups: [
      { id: "g2", name: "Spice", min_select: 0, max_select: 1, sort: 2, options: [{ id: "o3", name: "Hot", price_paise: 0, available: true, sort: 1 }] },
      { id: "g1", name: "Extras", min_select: 1, max_select: 2, sort: 1, options: [
        { id: "o2", name: "Papad", price_paise: 1000, available: false, sort: 2 }, { id: "o1", name: "Raita", price_paise: 2000, available: true, sort: 1 }] },
    ],
  })], NOW);
  const groups = m.categories[0].dishes[0].option_groups;
  assertEquals(groups.map((g) => [g.name, g.min, g.max]), [["Extras", 1, 2], ["Spice", 0, 1]]);
  assertEquals(groups[0].options, [{ id: "o1", name: "Raita", price_paise: 2000, sold_out: false }, { id: "o2", name: "Papad", price_paise: 1000, sold_out: true }]);
  assertEquals(Object.keys(groups[0]).sort(), ["id", "max", "min", "name", "options"]);
});

Deno.test("a dish with no groups has an empty list", () => {
  assertEquals(buildMenu([row({ id: "plain" })], NOW).categories[0].dishes[0].option_groups, []);
});
