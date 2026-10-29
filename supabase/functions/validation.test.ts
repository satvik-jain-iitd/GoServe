// Story #187 (H4): the Edge Functions mirror the database's field rules (docs/product/validation-rules.md). One test per rule; no network.
import { assertEquals } from "jsr:@std/assert@1";
import { parse } from "./quote/index.ts";
import { DEFAULT_RULES, MAX_QTY, quote } from "./quote/quote.ts";
import { makeHandler, type Deps } from "./orders/index.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001";
const D1 = "7e57ab1e-0000-4000-8000-0000000000d1";
const good = (o: Record<string, unknown> = {}) => ({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 1 }], address: { pin_code: "110016", text: "Flat 4" }, ...o });

Deno.test("pin: six digits", () => {
  assertEquals(parse(good())?.kitchen, K);
  for (const pin of ["1100", "11001a", "1100160", ""]) assertEquals(parse(good({ address: { pin_code: pin } })), null);
});

Deno.test("coupon code: 40 characters at most, trimmed and upper-cased", () => {
  assertEquals(parse(good({ coupon_code: " save10 " }))?.code, "SAVE10");
  assertEquals(parse(good({ coupon_code: "A".repeat(41) })), null);
});

Deno.test("lines: 30 at most", () => {
  assertEquals(parse(good({ lines: Array.from({ length: 31 }, () => ({ menu_item_id: D1, qty: 1 })) })), null);
});

Deno.test("quantity of a dish: 1 to 20", () => {
  assertEquals(MAX_QTY, 20);
  const dish = { dishes: { [D1]: { id: D1, name: "Thali", price_paise: 14000, available: true } }, options: {} };
  for (const qty of [0, 21, 1.5]) {
    const r = quote({ lines: [{ menu_item_id: D1, qty, option_ids: [] }], first_order: false }, dish, DEFAULT_RULES, null, () => ({ ok: true }));
    assertEquals((r as { error: string }).error, "invalid_quantity");
  }
});

Deno.test("address text: 1 to 300 characters, refused before any data source is touched", async () => {
  const never = () => { throw new Error("a data source was touched"); };
  const h = makeHandler({ session: never, existing: never, place: never, catalog: never, rules: never, coupon: never, coupons: never, validate: never, firstOrder: never, rate: never } as unknown as Deps);
  for (const text of ["", "   ", "a".repeat(301)]) {
    const res = await h(new Request("https://x.test/orders", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...good(), address: { pin_code: "110016", text }, idempotency_key: "key-12345678", expected_to_pay_paise: 100 }) }));
    assertEquals(res.status, 400);
  }
});
