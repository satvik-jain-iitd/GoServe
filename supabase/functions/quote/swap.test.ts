// Story #619 layer b: a sold-out dish gets one alternative chosen by the server, and a swap earns a discount (a percent of the new item, set by the admin).
// The pick rule is one deterministic rule: same kitchen, same veg flag, available now, nearest price, tie = lowest id; none = null. No network.
import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_RULES, pickAlternative, quote, type Catalog, type MenuRow } from "./quote.ts";

const row = (id: string, price_paise: number, o: Partial<MenuRow> = {}): MenuRow => ({ id, name: id.toUpperCase(), price_paise, veg: true, available: true, ...o });
const MENU: MenuRow[] = [row("paneer", 26000, { available: false }), row("dal", 22000), row("kofta", 24000, { veg: true }), row("chicken", 25500, { veg: false }), row("roti", 2000)];
const catalog: Catalog = { dishes: { paneer: { id: "paneer", name: "PANEER", price_paise: 26000, available: false, veg: true }, dal: { id: "dal", name: "DAL", price_paise: 22000, available: true, veg: true } }, options: {} };
const ask = (lines: { menu_item_id: string; qty: number; swap?: boolean }[], over: { menu?: MenuRow[]; swap_pct?: number } = {}) =>
  quote({ lines: lines.map((l) => ({ option_ids: [], ...l })), first_order: false, menu: over.menu ?? MENU, swap_pct: over.swap_pct ?? 10 }, catalog, DEFAULT_RULES, null, () => ({ ok: true }));

Deno.test("pick: same veg flag, available, nearest price", () => {
  const alt = pickAlternative({ id: "paneer", price_paise: 26000, veg: true }, MENU, 10);
  assertEquals(alt, { menu_item_id: "kofta", name: "KOFTA", price_paise: 24000, discount_paise: 2400 });   // 24000 is nearer than 22000; the non-veg 25500 is out
});

Deno.test("pick: a tie goes to the lowest id", () => {
  const menu = [row("x", 20000, { veg: true }), row("a", 20000), row("b", 30000)];
  assertEquals(pickAlternative({ id: "gone", price_paise: 25000, veg: true }, menu, 10)?.menu_item_id, "a");
});

Deno.test("pick: nothing available with the same veg flag gives null", () => {
  assertEquals(pickAlternative({ id: "paneer", price_paise: 26000, veg: true }, [row("chicken", 25500, { veg: false }), row("dal", 22000, { available: false })], 10), null);
});

Deno.test("a sold-out line without a swap is refused and carries the alternative", () => {
  const r = ask([{ menu_item_id: "paneer", qty: 1 }]);
  assertEquals(r.ok, false);
  assertEquals(!r.ok && [r.error, r.alternative], ["dish_sold_out", { menu_item_id: "kofta", name: "KOFTA", price_paise: 24000, discount_paise: 2400 }]);
});

Deno.test("a swap takes the server's pick at the same quantity, with the discount on the new item", () => {
  const r = ask([{ menu_item_id: "paneer", qty: 2, swap: true }]);
  assertEquals(r.ok && [r.lines.map((l) => [l.menu_item_id, l.qty, l.line_paise]), r.item_total_paise, r.swap_discount_paise, r.discount_paise, r.to_pay_paise],
    [[["kofta", 2, 48000]], 48000, 4800, 4800, 43200]);
  assertEquals(r.ok && r.effective, [{ menu_item_id: "kofta", qty: 2, option_ids: [] }]);
});

Deno.test("no discount, no error: the dish is on sale, so the swap flag does nothing", () => {
  const r = ask([{ menu_item_id: "dal", qty: 1, swap: true }]);
  assertEquals(r.ok && [r.lines[0].menu_item_id, r.discount_paise, r.swap_discount_paise ?? 0], ["dal", 0, 0]);
});

Deno.test("no alternative: a swap is refused as sold out, with alternative null", () => {
  const r = ask([{ menu_item_id: "paneer", qty: 1, swap: true }], { menu: [row("paneer", 26000, { available: false }), row("chicken", 25500, { veg: false })] });
  assertEquals(!r.ok && [r.error, r.alternative], ["dish_sold_out", null]);
});

Deno.test("one swap per sold-out dish: the same sold-out dish twice is refused", () => {
  const r = ask([{ menu_item_id: "paneer", qty: 1, swap: true }, { menu_item_id: "paneer", qty: 1, swap: true }]);
  assertEquals(!r.ok && r.error, "dish_sold_out");
});

Deno.test("the percent is the admin's: 0 gives no discount, and it never goes over 50", () => {
  const zero = ask([{ menu_item_id: "paneer", qty: 1, swap: true }], { swap_pct: 0 });
  assertEquals(zero.ok && [zero.discount_paise, zero.to_pay_paise], [0, 24000]);
  const big = ask([{ menu_item_id: "paneer", qty: 1, swap: true }], { swap_pct: 90 });
  assertEquals(big.ok && big.swap_discount_paise, 12000);   // 90 is cut to 50
});
