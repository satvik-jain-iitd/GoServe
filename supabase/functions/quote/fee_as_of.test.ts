// Story 1774 (epic 1753; owner, 22 Nov 2026): the bill uses the fee the customer's open app loaded, for up to 12 hours. POST /quote takes an optional fee_as_of; the fee comes
// from the database function delivery_fee_at_v1(fee_as_of). No network: the fake deps record what rules was asked. The real loader (one rpc, delivery_fee_at_v1) is proved by a real call on goserve-dev; CI gives Deno no env access.
import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_RULES, feeRules, type Catalog } from "./quote.ts";
import { makeHandler, parse, type Deps } from "./index.ts";

const D1 = "7e57ab1e-0000-4000-8000-0000000000d1", K = "7e57ab1e-0000-4000-8000-000000000001";
const catalog: Catalog = { dishes: { [D1]: { id: D1, name: "Chai", price_paise: 18000, available: true } }, options: {} };
const asked: [string, string | null][] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => catalog, rules: async (k, t) => { asked.push([k, t]); return feeRules(DEFAULT_RULES, [{ value: { amount_paise: t ? 0 : 2000 } }]); },
  coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }), firstOrder: async () => false, session: async () => "s1", ...o,
});
const post = (h: ReturnType<typeof makeHandler>, extra: Record<string, unknown> = {}) =>
  h(new Request("https://x.test/quote", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 1, option_ids: [] }], address: { pin_code: "110016" }, ...extra }) }));
const T = "2026-11-22T10:00:00.000Z";

Deno.test("AC-1 a fee_as_of reaches rules as an ISO time, and the bill carries that fee", async () => {
  asked.length = 0;
  const res = await post(makeHandler(deps()), { fee_as_of: "2026-11-22T10:00:00Z" });
  const q = await res.json();
  assertEquals([res.status, asked[0][1], q.fees.delivery_paise, q.to_pay_paise], [200, T, 0, 18000]);
});

Deno.test("AC-6 no fee_as_of: rules is asked with null, the live fee, as today", async () => {
  asked.length = 0;
  const res = await post(makeHandler(deps()));
  const q = await res.json();
  assertEquals([res.status, asked[0][1], q.fees.delivery_paise], [200, null, 2000]);
});

Deno.test("AC-3 a fee_as_of that is not a time is ignored: the live fee, never an error", async () => {
  for (const bad of ["garbage", "", 123, {}, [], true, "2026-13-45", "x".repeat(60)]) {
    asked.length = 0;
    const res = await post(makeHandler(deps()), { fee_as_of: bad });
    assertEquals([res.status, asked[0][1]], [200, null], JSON.stringify(bad));
  }
  assertEquals(parse({ kitchen_id: K, lines: [], address: { pin_code: "110016" }, fee_as_of: "nope" })?.feeAsOf, null);
});

Deno.test("AC-5 when the fee cannot be read the quote answers 502 quote_unavailable, also with a fee_as_of", async () => {
  const res = await post(makeHandler(deps({ rules: async () => { throw new Error("rpc down"); } })), { fee_as_of: T });
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "quote_unavailable" }]);
});
