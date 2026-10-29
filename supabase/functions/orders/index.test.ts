// Story #347: POST /orders. Re-quote, then place in one transaction. Scenario: Given a quote, when the order is placed twice with the same key,
// then one order exists; a changed price answers price_changed. Every data source is injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { DEFAULT_RULES } from "../quote/quote.ts";

const K = "7e57ab1e-0000-4000-8000-000000000001";
const D1 = "7e57ab1e-0000-4000-8000-0000000000d1";
const placed: unknown[][] = [];
const rated: unknown[][] = [];
const row = { id: "o1", kitchen_id: K, status: "placed", total_paise: 28000, address: "Flat 4, Green Park", items: [], bill: {}, created_at: "2026-10-27T10:00:00Z", customer_phone: "9876543210" };
const deps = (o: Partial<Deps> = {}): Deps => ({
  catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Thali", price_paise: 14000, available: true } }, options: {} }),
  rules: async () => DEFAULT_RULES, coupon: async () => null, coupons: async () => [], validate: async () => ({ ok: true }), firstOrder: async () => false,
  session: async () => "s1",
  existing: async () => null,
  rate: async (...a) => { rated.push(a); return { ok: true }; },
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

// Story #537: a retry with a known key returns the existing order before anything is re-quoted.
Deno.test("the same key after the dish sold out returns the existing order with created false (the scenario)", async () => {
  placed.length = 0;
  const soldOut = deps({ existing: async () => row, catalog: async () => ({ dishes: { [D1]: { id: D1, name: "Thali", price_paise: 14000, available: false } }, options: {} }) });
  const res = await post(makeHandler(soldOut), body());
  const o = await res.json();
  assertEquals([res.status, o.ok, o.created, o.order.id], [200, true, false, "o1"]);
  assertEquals(placed.length, 0);   // nothing was placed again
});

Deno.test("the same key after the price moved returns the existing order, not price_changed", async () => {
  const res = await post(makeHandler(deps({ existing: async () => row })), body({ expected_to_pay_paise: 25000 }));
  assertEquals([res.status, (await res.json()).created], [200, false]);
});

Deno.test("the lookup is for this caller and this key; a new key is quoted as before; no login is still 401", async () => {
  const asked: unknown[][] = [];
  const lookup = deps({ existing: async (...a) => { asked.push(a); return null; } });
  assertEquals((await post(makeHandler(lookup), body())).status, 201);
  assertEquals(asked, [["s1", "key-0001-abcd"]]);
  assertEquals((await post(makeHandler(deps({ session: async () => null, existing: async () => row })), body())).status, 401);
});

Deno.test("a dead lookup is 502 with no detail", async () => {
  const res = await post(makeHandler(deps({ existing: () => Promise.reject(new Error("host=10.0.0.1")) })), body());
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "order_unavailable" }]);
});

// Story #354: POST /orders/{id}/rating. Scenario: Given a delivered order, when a rating is posted, then food and rider scores are stored.
const rate = (h: ReturnType<typeof makeHandler>, b: unknown, o: { id?: string; token?: string | null } = {}) =>
  h(new Request(`https://x.test/orders/${o.id ?? "7e57ab1e-0000-4000-8000-0000000000f1"}/rating`, { method: "POST",
    headers: { "content-type": "application/json", ...(o.token === null ? {} : { authorization: `Bearer ${o.token ?? "t"}` }) }, body: JSON.stringify(b) }));

Deno.test("rating: a delivered order's food and rider scores go to the database for this caller (the scenario)", async () => {
  rated.length = 0;
  const res = await rate(makeHandler(deps()), { food_score: 5, rider_score: 4, comment: " Hot and on time " });
  assertEquals([res.status, await res.json()], [200, { ok: true }]);
  assertEquals(rated, [["7e57ab1e-0000-4000-8000-0000000000f1", "s1", 5, 4, "Hot and on time"]]);
});

Deno.test("rating: the rider score and the comment are optional", async () => {
  rated.length = 0;
  assertEquals((await rate(makeHandler(deps()), { food_score: 3 })).status, 200);
  assertEquals(rated[0].slice(2), [3, null, null]);
});

Deno.test("rating: refusals keep their code (404, 409, 422); no login is 401; a bad body is 400; a dead database is 502 with no detail", async () => {
  for (const [error, status] of [["order_not_found", 404], ["not_delivered", 409], ["already_rated", 409], ["invalid_score", 422], ["invalid_comment", 422], ["no_rider", 422]] as const) {
    const res = await rate(makeHandler(deps({ rate: async () => ({ ok: false, error, message: "m" }) })), { food_score: 5 });
    assertEquals([error, res.status, (await res.json()).error], [error, status, error]);
  }
  assertEquals((await rate(makeHandler(deps({ session: async (req) => (req.headers.get("authorization") ? "s1" : null) })), { food_score: 5 }, { token: null })).status, 401);
  for (const b of [{}, { food_score: "5" }, { food_score: 4.5 }, { food_score: 5, rider_score: "x" }, { food_score: 5, comment: 7 }, null]) {
    assertEquals((await rate(makeHandler(deps()), b)).status, 400, JSON.stringify(b));
  }
  assertEquals((await rate(makeHandler(deps()), { food_score: 5 }, { id: "not-a-uuid" })).status, 400);
  const dead = await rate(makeHandler(deps({ rate: () => Promise.reject(new Error("host=10.0.0.1")) })), { food_score: 5 });
  assertEquals([dead.status, await dead.json()], [502, { ok: false, error: "order_unavailable" }]);
});

Deno.test("rating: placing an order still works at /orders", async () => {
  assertEquals((await post(makeHandler(deps()), body())).status, 201);
});
