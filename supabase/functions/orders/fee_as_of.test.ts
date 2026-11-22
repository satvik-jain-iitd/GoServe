// Story 1774 (epic 1753): POST /orders takes the same fee_as_of and re-quotes with it, so a fee change inside the 12 hours does not answer 409 for that customer. No network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { feeRules, DEFAULT_RULES } from "../quote/quote.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001", D1 = "7e57ab1e-0000-4000-8000-0000000000d1", T = "2026-11-22T10:00:00.000Z";
const row = { id: "o1", kitchen_id: K, status: "placed", total_paise: 18000, address: "Flat 4, Green Park", items: [], bill: {}, created_at: "2026-11-22T10:00:00Z", customer_phone: "9000000000" };
const placed: unknown[][] = [];
const rulesAt = async (_k: string, t: string | null) => feeRules(DEFAULT_RULES, [{ value: { amount_paise: t ? 0 : 2000 } }]);   // the loaded fee was 0, the live fee is 2000
const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Chai", price_paise: 18000, available: true } }, options: {} }),
  rules: rulesAt, coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }), firstOrder: async () => false,
  session: async () => "s1", existing: async () => null, needsPoint: async () => false, rate: async () => ({ ok: true }),
  place: async (...a) => { placed.push(a); return { ok: true, created: true, order: row }; }, ...o,
});
const body = (expected: number, extra: Record<string, unknown> = {}) => ({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 1, option_ids: [] }], address: { pin_code: "110016", text: "Flat 4, Green Park" }, idempotency_key: "key-0001-abcd", expected_to_pay_paise: expected, ...extra });
const post = (h: ReturnType<typeof makeHandler>, b: unknown) =>
  h(new Request("https://x.test/orders", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer t" }, body: JSON.stringify(b) }));

Deno.test("AC-2 the price the app showed with its loaded fee is accepted, although the live fee changed", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body(18000, { fee_as_of: T }));
  assertEquals([res.status, placed.length], [201, 1]);
});

Deno.test("AC-6 an old app with no fee_as_of is quoted with the live fee: the same total answers 409 price_changed, as today", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body(18000));
  const o = await res.json();
  assertEquals([res.status, o.error, o.quote.fees.delivery_paise, placed.length], [409, "price_changed", 2000, 0]);
});

Deno.test("AC-3 a bad fee_as_of is ignored: the live fee is used, no 400", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body(20000, { fee_as_of: "garbage" }));
  assertEquals([res.status, placed.length], [201, 1]);
});

Deno.test("AC-4 the order stores the fee it charged in bill.fees.delivery_paise", async () => {
  placed.length = 0;
  await post(makeHandler(deps({ rules: async (_k, t) => feeRules(DEFAULT_RULES, [{ value: { amount_paise: t ? 1000 : 2000 } }]) })), body(19000, { fee_as_of: T }));
  const bill = placed[0][6] as { fees: { delivery_paise: number } };
  assertEquals(bill.fees.delivery_paise, 1000);
});

Deno.test("AC-5 when the fee cannot be read the order answers 502 order_unavailable and nothing is placed", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ rules: async () => { throw new Error("rpc down"); } })), body(18000, { fee_as_of: T }));
  assertEquals([res.status, (await res.json()).error, placed.length], [502, "order_unavailable", 0]);
});
