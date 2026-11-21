// Story 1755 (epic 1753): a fee change and the orders function. No network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { feeRules, DEFAULT_RULES } from "../quote/quote.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001", D1 = "7e57ab1e-0000-4000-8000-0000000000d1";
const row = { id: "o1", kitchen_id: K, status: "placed", total_paise: 18000, address: "Flat 4, Green Park", items: [], bill: {}, created_at: "2026-11-22T10:00:00Z", customer_phone: "9000000000" };
const fee = (paise: number) => async () => feeRules(DEFAULT_RULES, [{ value: { amount_paise: paise } }]);
const placed: unknown[][] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Chai", price_paise: 18000, available: true } }, options: {} }),
  rules: async () => DEFAULT_RULES, coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }), firstOrder: async () => false,
  session: async () => "s1", existing: async () => null, needsPoint: async () => false, rate: async () => ({ ok: true }),
  place: async (...a) => { placed.push(a); return { ok: true, created: true, order: row }; }, ...o,
});
const body = (expected: number) => ({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 1, option_ids: [] }], address: { pin_code: "110016", text: "Flat 4, Green Park" }, idempotency_key: "key-0001-abcd", expected_to_pay_paise: expected });
const post = (h: ReturnType<typeof makeHandler>, b: unknown) =>
  h(new Request("https://x.test/orders", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer t" }, body: JSON.stringify(b) }));

Deno.test("AC-4 the price seen before the fee changed answers 409 price_changed with the new quote, and no order is made", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ rules: fee(2000) })), body(18000));   // the customer saw 18000 when the fee was 0
  const o = await res.json();
  assertEquals([res.status, o.error, o.quote.fees.delivery_paise, o.quote.to_pay_paise], [409, "price_changed", 2000, 20000]);
  assertEquals(placed.length, 0);
});

Deno.test("AC-4 the new price is accepted and the order is made", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ rules: fee(2000) })), body(20000));
  assertEquals([res.status, placed.length], [201, 1]);
});

Deno.test("AC-5 an order placed before a change keeps its own total: the same key after the fee change returns the stored order", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ rules: fee(3000), existing: async () => row })), body(18000));
  const o = await res.json();
  assertEquals([res.status, o.created, o.order.total_paise, placed.length], [200, false, 18000, 0]);
});
