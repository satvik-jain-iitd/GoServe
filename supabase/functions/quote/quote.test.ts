// Story #345 (E27, plan v2 B.9): the only bill math. Scenario: Given lines, add-ons, an address and a coupon, when a quote is asked, then it returns
// item total, fees, discount, tax, to pay and what you saved. Every rule has a test. Money is whole paise; there is no float in the answer.
import { assertEquals } from "jsr:@std/assert@1";
import { quote, DEFAULT_RULES, type Catalog, type Coupon, type Rules } from "./quote.ts";

const catalog: Catalog = {
  dishes: {
    thali: { id: "thali", name: "Dal Makhani thali", price_paise: 14000, available: true },
    chai: { id: "chai", name: "Masala chai", price_paise: 3000, available: true },
    gone: { id: "gone", name: "Sold out thali", price_paise: 9000, available: false },
  },
  options: { raita: { id: "raita", name: "Raita", price_paise: 2000 }, papad: { id: "papad", name: "Papad", price_paise: 1000 } },
};
const rules = (o: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, ...o });
const ask = (lines: { menu_item_id: string; qty: number; option_ids?: string[] }[], r: Rules = DEFAULT_RULES, coupon: Coupon | null = null, first_order = false) =>
  quote({ lines: lines.map((l) => ({ option_ids: [], ...l })), first_order }, catalog, r, coupon, () => ({ ok: true }));

Deno.test("plain: item total is price times quantity; with the default rules nothing is added", () => {
  const q = ask([{ menu_item_id: "thali", qty: 2 }]);
  assertEquals(q, {
    ok: true,
    lines: [{ menu_item_id: "thali", name: "Dal Makhani thali", qty: 2, unit_paise: 14000, extras_paise: 0, line_paise: 28000, options: [] }],
    item_total_paise: 28000, fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, discount_paise: 0, coupon: null,
    tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 28000, saved_paise: 0,
  });
});

Deno.test("add-ons are priced per dish and multiplied by the quantity", () => {
  const q = ask([{ menu_item_id: "thali", qty: 2, option_ids: ["raita", "papad"] }, { menu_item_id: "chai", qty: 1 }]);
  assertEquals(q.ok && [q.lines[0].extras_paise, q.lines[0].line_paise, q.item_total_paise, q.lines[0].options], [3000, 34000, 37000, ["Raita", "Papad"]]);
});

Deno.test("delivery fee, free above a basket size; the waived fee counts as saved", () => {
  const r = rules({ delivery_fee_paise: 3000, free_delivery_above_paise: 30000 });
  const small = ask([{ menu_item_id: "thali", qty: 2 }], r);
  const big = ask([{ menu_item_id: "thali", qty: 3 }], r);
  assertEquals(small.ok && [small.fees.delivery_paise, small.to_pay_paise, small.saved_paise], [3000, 31000, 0]);
  assertEquals(big.ok && [big.fees.delivery_paise, big.to_pay_paise, big.saved_paise], [0, 42000, 3000]);
});

Deno.test("packaging is a flat fee per order and joins the fee total", () => {
  const q = ask([{ menu_item_id: "chai", qty: 3 }], rules({ delivery_fee_paise: 2000, packaging_paise: 500 }));
  assertEquals(q.ok && [q.fees, q.to_pay_paise], [{ delivery_paise: 2000, packaging_paise: 500, total_paise: 2500 }, 11500]);
});

const flat: Coupon = { code: "FLAT50", title: "Rs 50 off", kind: "flat", amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 20000, first_order_only: false };
const pct: Coupon = { code: "TEN", title: "10% off up to Rs 30", kind: "percent", amount_paise: 0, percent: 10, cap_paise: 3000, min_order_paise: 0, first_order_only: false };

Deno.test("a flat coupon takes its amount off and counts as saved", () => {
  const q = ask([{ menu_item_id: "thali", qty: 2 }], DEFAULT_RULES, flat);
  assertEquals(q.ok && [q.discount_paise, q.coupon, q.to_pay_paise, q.saved_paise], [5000, { code: "FLAT50", title: "Rs 50 off" }, 23000, 5000]);
});

Deno.test("a percent coupon is capped; below the cap it is the exact percent, rounded down", () => {
  assertEquals((ask([{ menu_item_id: "thali", qty: 3 }], DEFAULT_RULES, pct) as { discount_paise: number }).discount_paise, 3000);   // 10% of 42000 is 4200, capped at 3000
  assertEquals((ask([{ menu_item_id: "chai", qty: 1 }], DEFAULT_RULES, { ...pct, percent: 7 }) as { discount_paise: number }).discount_paise, 210);   // 7% of 3000
  assertEquals((ask([{ menu_item_id: "chai", qty: 1 }], DEFAULT_RULES, { ...pct, percent: 1, cap_paise: 0 }) as { discount_paise: number }).discount_paise, 30);   // cap 0 means no cap
});

Deno.test("a coupon never takes more than the items cost", () => {
  const q = ask([{ menu_item_id: "chai", qty: 1 }], DEFAULT_RULES, { ...flat, amount_paise: 99999, min_order_paise: 0 });
  assertEquals(q.ok && [q.discount_paise, q.to_pay_paise], [3000, 0]);
});

Deno.test("a coupon below its minimum, or for a first order only, is refused with a clear message, not silently dropped", () => {
  const low = ask([{ menu_item_id: "chai", qty: 1 }], DEFAULT_RULES, flat);
  assertEquals(!low.ok && [low.error, low.message], ["coupon_minimum", "FLAT50 needs at least Rs 200 of food."]);
  const first = ask([{ menu_item_id: "thali", qty: 2 }], DEFAULT_RULES, { ...flat, first_order_only: true }, false);
  assertEquals(!first.ok && first.error, "coupon_first_order");
  assertEquals(ask([{ menu_item_id: "thali", qty: 2 }], DEFAULT_RULES, { ...flat, first_order_only: true }, true).ok, true);
});

Deno.test("tax: exclusive is added on food plus fees minus the discount; inclusive is already inside the prices and only shown", () => {
  const ex = ask([{ menu_item_id: "thali", qty: 1 }], rules({ tax_pct: 5, tax_mode: "exclusive", delivery_fee_paise: 2000 }));
  assertEquals(ex.ok && [ex.tax_paise, ex.to_pay_paise], [800, 16800]);   // 5% of 16000
  const inc = ask([{ menu_item_id: "thali", qty: 1 }], rules({ tax_pct: 5, tax_mode: "inclusive" }));
  assertEquals(inc.ok && [inc.tax_paise, inc.to_pay_paise], [667, 14000]);   // 14000 * 5 / 105, rounded half up
  const half = ask([{ menu_item_id: "chai", qty: 1 }], rules({ tax_pct: 5, tax_mode: "exclusive" }));
  assertEquals(half.ok && half.tax_paise, 150);
});

Deno.test("bad lines are refused: empty, quantity out of 1 to 20, a dish that is not on the menu, a sold-out dish", () => {
  const err = (lines: Parameters<typeof ask>[0]) => { const q = ask(lines); return q.ok ? "ok" : q.error; };
  assertEquals(err([]), "empty_order");
  assertEquals(err([{ menu_item_id: "thali", qty: 0 }]), "invalid_quantity");
  assertEquals(err([{ menu_item_id: "thali", qty: 21 }]), "invalid_quantity");
  assertEquals(err([{ menu_item_id: "thali", qty: 1.5 }]), "invalid_quantity");
  assertEquals(err([{ menu_item_id: "nope", qty: 1 }]), "unknown_dish");
  assertEquals(err([{ menu_item_id: "gone", qty: 1 }]), "dish_sold_out");
});

Deno.test("an add-on pick the database refuses is passed through with its own message", () => {
  const q = quote({ lines: [{ menu_item_id: "thali", qty: 1, option_ids: ["raita"] }], first_order: false }, catalog, DEFAULT_RULES, null,
    () => ({ ok: false, error: "option_group_max", message: "Pick at most 2 for Extras." }));
  assertEquals(!q.ok && [q.error, q.message], ["option_group_max", "Pick at most 2 for Extras."]);
});
