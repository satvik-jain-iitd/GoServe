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

// Story #905: the order keeps the customer's drop point. A good fix is passed to the DB; a missing or bad one is passed as null, and never refuses the order.
Deno.test("a drop point in the address reaches the DB as lat and lng", async () => {
  placed.length = 0;
  const b = body({ address: { pin_code: "110016", text: "Flat 4, Green Park", lat: 28.5677, lng: 77.2432 } });
  assertEquals((await post(makeHandler(deps()), b)).status, 201);
  assertEquals(placed[0][7], { lat: 28.5677, lng: 77.2432 });
});

Deno.test("no drop point, or a bad one, reaches the DB as null and the order still goes", async () => {
  for (const address of [{ pin_code: "110016", text: "Flat 4" }, { pin_code: "110016", text: "Flat 4", lat: 91, lng: 77 }, { pin_code: "110016", text: "Flat 4", lat: "x", lng: 77 }, { pin_code: "110016", text: "Flat 4", lat: 28.5 }]) {
    placed.length = 0;
    assertEquals((await post(makeHandler(deps()), body({ address }))).status, 201);
    assertEquals(placed[0][7], null);
  }
});

// Story #935: an optional note for the kitchen, up to 200 characters, trimmed, null when blank; a longer one is refused before anything is written.
Deno.test("a note reaches the DB trimmed, and the placed order answers with it", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ place: async (...a) => { placed.push(a); return { ok: true, created: true, order: { ...row, instructions: "No onion" } }; } })), body({ instructions: "  No onion  " }));
  assertEquals(res.status, 201);
  assertEquals((await res.json()).order.instructions, "No onion");
  assertEquals(placed[0][8], "No onion");
});

Deno.test("no note, or a blank one, reaches the DB as null", async () => {
  for (const b of [body(), body({ instructions: "   " }), body({ instructions: null })]) {
    placed.length = 0;
    assertEquals((await post(makeHandler(deps()), b)).status, 201);
    assertEquals(placed[0][8], null);
  }
});

Deno.test("a note of 201 characters is 422 instructions_too_long with a plain line, and nothing is placed; 200 is fine", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps()), body({ instructions: "x".repeat(201) }));
  const o = await res.json();
  assertEquals([res.status, o.ok, o.error], [422, false, "instructions_too_long"]);
  assertEquals(o.message.includes("200"), true);
  assertEquals(placed.length, 0);
  assertEquals((await post(makeHandler(deps()), body({ instructions: "x".repeat(200) }))).status, 201);
});

Deno.test("a note that is not text is 400 invalid_request", async () => {
  for (const v of [5, {}, ["a"], true]) assertEquals((await post(makeHandler(deps()), body({ instructions: v }))).status, 400);
});

// Story #995: a personal coupon (the apology coupon of a late order) is in the customer's list. With nothing said the server applies it by itself, so an order that expects the item total is
// answered price_changed with the coupon's total; the same order that says no_coupon, or expects the discounted total, is placed. The app now asks the question it expects the answer to.
const LATE = { code: "LATE-1", title: "Sorry we were late", kind: "flat" as const, amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 0, first_order_only: false };
Deno.test("with a personal coupon in the list: no_coupon expects the item total; nothing said expects the discounted total", async () => {
  placed.length = 0;
  const h = makeHandler(deps({ coupons: async () => [LATE] }));
  let res = await post(h, body({ no_coupon: true }));
  assertEquals(res.status, 201);
  res = await post(h, body());
  assertEquals([res.status, (await res.json()).quote.to_pay_paise], [409, 23000]);   // the server applied the coupon by itself
  res = await post(h, body({ expected_to_pay_paise: 23000 }));
  assertEquals(res.status, 201);
  assertEquals((placed.at(-1) as unknown[])[6] && ((placed.at(-1) as unknown[])[6] as Record<string, number>).to_pay_paise, 23000);
});

// Story #1145 (#1113): the order goes to the database with the pin of the address it is for, and the bill carries the quote's early-friend gift.
Deno.test("the address pin goes to the database, and the gift the quote showed is on the bill it checks", async () => {
  placed.length = 0;
  const gift = deps({ earlyFriend: async () => 10000 });
  const res = await post(makeHandler(gift), body({ expected_to_pay_paise: 18000 }));
  assertEquals(res.status, 201);
  const [, , , , , , bill, , , pin] = placed[0] as [string, string, string, unknown, string, number, Record<string, number>, unknown, unknown, string];
  assertEquals([bill.early_friend_paise, bill.to_pay_paise, pin], [10000, 18000, "110016"]);
});

Deno.test("the customer saw the full price but the promise now gives a gift: the order is a changed price", async () => {
  placed.length = 0;
  const res = await post(makeHandler(deps({ earlyFriend: async () => 10000 })), body());   // body() expects 28000
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "price_changed");
  assertEquals(placed.length, 0);
});
