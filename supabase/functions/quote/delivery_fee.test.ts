// Story 1755 (epic 1753): the delivery fee on the bill is the admin's setting row `delivery_fee`, the same for every basket. No network: the settings rows are passed in.
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { feeRules, quote, DEFAULT_RULES, type Catalog } from "./quote.ts";
import { makeHandler, type Deps } from "./index.ts";

const D1 = "7e57ab1e-0000-4000-8000-0000000000d1", D2 = "7e57ab1e-0000-4000-8000-0000000000d2", K = "7e57ab1e-0000-4000-8000-000000000001";
const catalog: Catalog = { dishes: { [D1]: { id: D1, name: "Chai", price_paise: 18000, available: true }, [D2]: { id: D2, name: "Big thali", price_paise: 90000, available: true } }, options: {} };
const ask = (id: string, rules: ReturnType<typeof feeRules>) => quote({ lines: [{ menu_item_id: id, qty: 1, option_ids: [] }], first_order: false }, catalog, rules, null, () => ({ ok: true }));
const row = (amount: unknown) => [{ value: { amount_paise: amount } }];

Deno.test("AC-1 with the setting at 2000, a Rs 180 basket has delivery 2000 and to pay 20000", () => {
  const q = ask(D1, feeRules(DEFAULT_RULES, row(2000)));
  if (!q.ok) throw new Error("refused");
  assertEquals([q.fees.delivery_paise, q.to_pay_paise], [2000, 20000]);
});

Deno.test("AC-2 with the setting at 0 or the row missing, delivery is 0", () => {
  for (const rows of [row(0), []]) {
    const q = ask(D1, feeRules(DEFAULT_RULES, rows));
    if (!q.ok) throw new Error("refused");
    assertEquals([q.fees.delivery_paise, q.to_pay_paise], [0, 18000]);
  }
});

Deno.test("AC-3 the fee is the same for a small and a big basket, even when a params row says free above an amount", () => {
  const rules = feeRules({ ...DEFAULT_RULES, delivery_fee_paise: 500, free_delivery_above_paise: 30000 }, row(2000));
  assertEquals(rules.free_delivery_above_paise, 0);
  for (const id of [D1, D2]) {
    const q = ask(id, rules);
    if (!q.ok) throw new Error("refused");
    assertEquals(q.fees.delivery_paise, 2000);
  }
});

Deno.test("AC-3 the setting wins over the params fee", () => {
  assertEquals(feeRules({ ...DEFAULT_RULES, delivery_fee_paise: 500 }, row(2000)).delivery_fee_paise, 2000);
});

Deno.test("AC-6 a bad value is an error, never a free delivery", () => {
  for (const bad of ["2000", null, -100, 150, 20100, 1.5, undefined]) assertThrows(() => feeRules(DEFAULT_RULES, row(bad)));
  assertThrows(() => feeRules(DEFAULT_RULES, [{ value: null }]));
  assertThrows(() => feeRules(DEFAULT_RULES, "not rows"));
});

const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => catalog, rules: async () => DEFAULT_RULES, coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }),
  firstOrder: async () => false, session: async () => "s1", ...o,
});
const post = (h: ReturnType<typeof makeHandler>) =>
  h(new Request("https://x.test/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 1, option_ids: [] }], address: { pin_code: "110016" } }) }));

Deno.test("AC-6 when the setting cannot be read the quote answers 502 quote_unavailable, with no detail", async () => {
  const res = await post(makeHandler(deps({ rules: async () => { throw new Error("settings down"); } })));
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "quote_unavailable" }]);
});

Deno.test("AC-1 through the handler: the bill answer carries the fee", async () => {
  const res = await post(makeHandler(deps({ rules: async () => feeRules(DEFAULT_RULES, row(2000)) })));
  const q = await res.json();
  assertEquals([res.status, q.fees.delivery_paise, q.to_pay_paise], [200, 2000, 20000]);
});
