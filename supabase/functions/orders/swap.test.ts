// Story #619 layer b: POST /orders with a sold-out dish. The refusal carries the server's alternative; a swap orders the lines after the swap, with the discount in the bill.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { makeHandler as makeQuote } from "../quote/index.ts";
import { DEFAULT_RULES } from "../quote/quote.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001";
const PANEER = "7e57ab1e-0000-4000-8000-0000000000d1";
const KOFTA = "7e57ab1e-0000-4000-8000-0000000000d2";
const placed: unknown[][] = [];
const MENU = [
  { id: PANEER, name: "Paneer", price_paise: 26000, available: false, veg: true },
  { id: KOFTA, name: "Kofta", price_paise: 24000, available: true, veg: true },
];
const deps = (pct = 10): Deps => ({
  catalog: async (_k, ids) => ({ dishes: Object.fromEntries(MENU.filter((m) => ids.includes(m.id)).map((m) => [m.id, m])), options: {} }),
  rules: async () => DEFAULT_RULES, coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }), firstOrder: async () => false,
  session: async () => "s1", existing: async () => null, rate: async () => ({ ok: true }),
  place: async (...a) => { placed.push(a); return { ok: true, created: true, order: { id: "o1", kitchen_id: K, status: "placed", total_paise: 0, address: "x", items: [], bill: {}, created_at: "2026-10-29T10:00:00Z" } }; },
  menu: async () => MENU, swapPct: async () => pct,
});
const body = (line: Record<string, unknown>, expected = 0) => ({ kitchen_id: K, lines: [{ option_ids: [], ...line }], address: { pin_code: "110016", text: "Flat 4" }, idempotency_key: "key-0001-abcd", expected_to_pay_paise: expected });
const post = (h: ReturnType<typeof makeHandler>, b: unknown) => h(new Request("https://x.test/orders", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer t" }, body: JSON.stringify(b) }));

Deno.test("a sold-out dish is refused as sold_out and the refusal carries the alternative", async () => {
  const res = await post(makeHandler(deps()), body({ menu_item_id: PANEER, qty: 1 }));
  const o = await res.json();
  assertEquals([res.status, o.error, o.alternative], [422, "sold_out", { menu_item_id: KOFTA, name: "Kofta", price_paise: 24000, discount_paise: 2400 }]);
});

Deno.test("a swap places the alternative at the same quantity and puts the discount in the bill", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body({ menu_item_id: PANEER, qty: 2, swap: true }, 43200));   // 2 x 24000 less 10%
  assertEquals(res.status, 201);
  const [, , , lines, , itemTotal, bill] = placed[0] as [string, string, string, unknown, string, number, Record<string, unknown>];
  assertEquals(lines, [{ menu_item_id: KOFTA, qty: 2, option_ids: [] }]);
  assertEquals([itemTotal, bill.to_pay_paise, bill.swap_discount_paise, bill.discount_paise], [48000, 43200, 4800, 4800]);
  assertEquals("effective" in bill, false);
});

Deno.test("the price the customer saw must match: a swap at the old total answers price_changed", async () => {
  const res = await post(makeHandler(deps()), body({ menu_item_id: PANEER, qty: 2, swap: true }, 48000));
  assertEquals([res.status, (await res.json()).error], [409, "price_changed"]);
});

Deno.test("the percent is read at quote time", async () => {
  const res = await post(makeHandler(deps(20)), body({ menu_item_id: PANEER, qty: 1, swap: true }, 19200));
  assertEquals(res.status, 201);
});

Deno.test("POST /quote shows the swap and never the lines to order", async () => {
  const res = await makeQuote(deps())(new Request("https://x.test/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kitchen_id: K, lines: [{ menu_item_id: PANEER, qty: 1, swap: true }], address: { pin_code: "110016" } }) }));
  const o = await res.json();
  assertEquals([res.status, o.lines[0].menu_item_id, o.swap_discount_paise, o.to_pay_paise, "effective" in o], [200, KOFTA, 2400, 21600, false]);
});
