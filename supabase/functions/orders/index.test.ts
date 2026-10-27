// Story #347: POST /orders. Re-quote, then place in one transaction. Scenario: Given a quote, when the order is placed twice with the same key,
// then one order exists; a changed price answers price_changed. Every data source is injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { DEFAULT_RULES } from "../quote/quote.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001";
const D1 = "7e57ab1e-0000-4000-8000-0000000000d1";
const placed: unknown[][] = [];
const row = { id: "o1", kitchen_id: K, status: "placed", total_paise: 28000, address: "Flat 4, Green Park", items: [], bill: {}, created_at: "2026-10-27T10:00:00Z", customer_phone: "9876543210" };
const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Thali", price_paise: 14000, available: true } }, options: {} }),
  rules: async () => DEFAULT_RULES, coupon: async () => null, validate: async () => ({ ok: true }), firstOrder: async () => false,
  session: async () => "s1",
  place: async (...a) => { placed.push(a); return { ok: true, created: true, order: row }; }, ...o,
});
const body = (o: Record<string, unknown> = {}) => ({ kitchen_id: K, lines: [{ menu_item_id: D1, qty: 2, option_ids: [] }], address: { pin_code: "110016", text: "Flat 4, Green Park" }, idempotency_key: "key-0001-abcd", expected_to_pay_paise: 28000, ...o });
const post = (h: ReturnType<typeof makeHandler>, b: unknown, method = "POST") =>
  h(new Request("https://x.test/orders", { method, headers: { "content-type": "application/json", authorization: "Bearer t" }, body: method === "POST" ? JSON.stringify(b) : undefined }));

Deno.test("a good order answers 201 with the order and passes the DB the session, key, lines, item total and the bill", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body());
  assertEquals(res.status, 201);
  const o = await res.json();
  assertEquals([o.ok, o.created, o.order.id, o.order.status, o.order.total_paise], [true, true, "o1", "placed", 28000]);
  assertEquals("customer_phone" in o.order, false);   // only the fields the contract lists
  const [session, key, kitchen, lines, address, itemTotal, bill] = placed[0] as [string, string, string, unknown, string, number, Record<string, number>];
  assertEquals([session, key, kitchen, address, itemTotal, bill.to_pay_paise], ["s1", "key-0001-abcd", K, "Flat 4, Green Park", 28000, 28000]);
  assertEquals(lines, [{ menu_item_id: D1, qty: 2, option_ids: [] }]);
});

Deno.test("the same key again answers 200 and created false", async () => {
  const res = await post(makeHandler(deps({ place: async () => ({ ok: true, created: false, order: row }) })), body());
  assertEquals([res.status, (await res.json()).created], [200, false]);
});

Deno.test("a price the customer did not see answers 409 price_changed with the new quote, and nothing is placed", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body({ expected_to_pay_paise: 25000 }));
  assertEquals(res.status, 409);
  const o = await res.json();
  assertEquals([o.ok, o.error, o.quote.to_pay_paise], [false, "price_changed", 28000]);
  assertEquals(placed.length, 0);
});

Deno.test("the DB answering price_changed (a price moved after the quote) is a 409 too", async () => {
  const res = await post(makeHandler(deps({ place: async () => ({ ok: false, error: "price_changed", message: "A price changed. Check the bill again." }) })), body());
  assertEquals([res.status, (await res.json()).error], [409, "price_changed"]);
});

Deno.test("sold_out, kitchen_closed and an add-on refusal are 422 with their own code", async () => {
  const sold = makeHandler(deps({ catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Thali", price_paise: 14000, available: false } }, options: {} }) }));
  assertEquals([(await post(sold, body())).status, (await (await post(sold, body())).json()).error], [422, "sold_out"]);
  const closed = makeHandler(deps({ place: async () => ({ ok: false, error: "kitchen_closed", message: "The kitchen is not taking orders now." }) }));
  const res = await post(closed, body());
  assertEquals([res.status, (await res.json()).error], [422, "kitchen_closed"]);
  const pick = makeHandler(deps({ validate: async () => ({ ok: false, error: "option_group_max", message: "Pick at most 2 for Extras." }) }));
  assertEquals((await (await post(pick, body())).json()).error, "option_group_max");
});

Deno.test("no login is 401 unauthorized and nothing is quoted or placed", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ session: async () => null })), body());
  assertEquals([res.status, (await res.json()).error], [401, "unauthorized"]);
  assertEquals(placed.length, 0);
});

Deno.test("a malformed request is 400 invalid_request: no key, a short key, no expected price, no address text, not JSON", async () => {
  const h = makeHandler(deps());
  for (const b of [body({ idempotency_key: undefined }), body({ idempotency_key: "short" }), body({ expected_to_pay_paise: undefined }), body({ expected_to_pay_paise: -5 }), body({ expected_to_pay_paise: 1.5 }),
    body({ address: { pin_code: "110016" } }), body({ address: { pin_code: "110016", text: "  " } }), body({ lines: "no" })]) {
    const res = await post(h, b);
    assertEquals([res.status, (await res.json()).error], [400, "invalid_request"]);
  }
  assertEquals((await h(new Request("https://x.test/orders", { method: "POST", body: "{nope" }))).status, 400);
});

Deno.test("when a data source fails the answer is 502 order_unavailable and no detail leaks", async () => {
  const res = await post(makeHandler(deps({ place: () => Promise.reject(new Error("password=secret")) })), body());
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "order_unavailable" }]);
});

Deno.test("anything but POST is 405", async () => {
  const res = await post(makeHandler(deps()), null, "GET");
  assertEquals([res.status, res.headers.get("allow")], [405, "POST"]);
});
