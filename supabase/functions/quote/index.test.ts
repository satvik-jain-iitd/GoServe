// Story #345: POST /quote. The data sources are injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { DEFAULT_RULES, type Coupon } from "./quote.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001";
const D1 = "7e57ab1e-0000-4000-8000-0000000000d1";
const O1 = "7e57ab1e-0000-4000-8000-0000000000e1";
const flat: Coupon = { code: "FLAT50", title: "Rs 50 off", kind: "flat", amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 0, first_order_only: false };
const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Thali", price_paise: 14000, available: true } }, options: { [O1]: { id: O1, name: "Raita", price_paise: 2000 } } }),
  rules: async () => DEFAULT_RULES, coupon: async (c) => (c === "FLAT50" ? flat : null), validate: async () => ({ ok: true }), firstOrder: async () => false, ...o,
});
const body = (o: Record<string, unknown> = {}) => ({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 2, option_ids: [O1] }], address: { pin_code: "110016" }, ...o });
const post = (h: ReturnType<typeof makeHandler>, b: unknown, method = "POST") =>
  h(new Request("https://x.test/quote", { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(b) : undefined }));

Deno.test("a good request answers 200 with the quote", async () => {
  const res = await post(makeHandler(deps()), body({ coupon_code: "FLAT50" }));
  assertEquals(res.status, 200);
  const q = await res.json();
  assertEquals([q.ok, q.kitchen_id, q.item_total_paise, q.discount_paise, q.to_pay_paise, q.saved_paise], [true, K, 32000, 5000, 27000, 5000]);
});

Deno.test("the price comes from the catalog, never from the request", async () => {
  const q = await (await post(makeHandler(deps()), body({ lines: [{ menu_item_id: D1, qty: 1, option_ids: [], price_paise: 1 }] }))).json();
  assertEquals(q.item_total_paise, 14000);
});

Deno.test("a refusal is 422 with its code and message (sold out, coupon rules, a bad add-on pick)", async () => {
  const bad = makeHandler(deps({ validate: async () => ({ ok: false, error: "option_group_max", message: "Pick at most 2 for Extras." }) }));
  const res = await post(bad, body());
  assertEquals(res.status, 422);
  assertEquals(await res.json(), { ok: false, error: "option_group_max", message: "Pick at most 2 for Extras." });
});

Deno.test("an unknown coupon code is refused as coupon_invalid, never dropped", async () => {
  const res = await post(makeHandler(deps()), body({ coupon_code: "NOPE" }));
  assertEquals([res.status, (await res.json()).error], [422, "coupon_invalid"]);
});

Deno.test("a malformed request is 400 invalid_request: no kitchen, no lines, a bad pin, a bad coupon, too many lines, not JSON", async () => {
  const h = makeHandler(deps());
  for (const b of [body({ kitchen_id: "x" }), body({ lines: "no" }), body({ address: {} }), body({ address: { pin_code: "11" } }), body({ coupon_code: 5 }),
    body({ lines: Array.from({ length: 31 }, () => ({ menu_item_id: D1, qty: 1 })) }), body({ lines: [{ menu_item_id: "not-a-uuid", qty: 1 }] })]) {
    const res = await post(h, b);
    assertEquals([res.status, (await res.json()).error], [400, "invalid_request"]);
  }
  const res = await h(new Request("https://x.test/quote", { method: "POST", body: "{nope" }));
  assertEquals(res.status, 400);
});

Deno.test("when a data source fails the answer is 502 quote_unavailable and no detail leaks", async () => {
  const res = await post(makeHandler(deps({ catalog: () => Promise.reject(new Error("password=secret")) })), body());
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "quote_unavailable" }]);
});

Deno.test("anything but POST is 405", async () => {
  const res = await post(makeHandler(deps()), null, "GET");
  assertEquals([res.status, res.headers.get("allow")], [405, "POST"]);
});
