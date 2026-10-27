// Story #338 (E27, plan v2 B.2). Scenario: Given api/openapi.yaml, when a function answers a wrong field, then CI is red.
// The contract is api/openapi.yaml. Every path names its handler (x-handler); this test calls each handler in process and checks the answer against the
// schema of that status code. Schemas say additionalProperties false, so a wrong or extra field is red. Run: deno test --allow-read api supabase/functions
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { parse } from "jsr:@std/yaml@1";
import Ajv2020 from "npm:ajv@8/dist/2020.js";
import addFormats from "npm:ajv-formats@3";

type Json = Record<string, any>;
const spec = parse(await Deno.readTextFile(new URL("./openapi.yaml", import.meta.url))) as Json;

const ajv = new Ajv2020.default({ strict: true, allErrors: true });
addFormats.default(ajv);
// OpenAPI keeps schemas under components/schemas; JSON Schema wants $defs. Move them and point every $ref there.
const toRefs = (x: unknown): unknown => JSON.parse(JSON.stringify(x).replaceAll("#/components/schemas/", "spec#/$defs/"));
ajv.addSchema({ $id: "spec", $defs: toRefs(spec.components.schemas) as Json });
const resolve = (schema: Json): Json => toRefs(schema) as Json;

// Check one answer against the schema of its status code. Throws a message that names the path and the first error.
export async function checkAnswer(path: string, method: string, res: Response): Promise<void> {
  const op = spec.paths[path]?.[method];
  assert(op, `${method.toUpperCase()} ${path} is not in api/openapi.yaml`);
  const declared = op.responses?.[String(res.status)];
  assert(declared, `${method.toUpperCase()} ${path} answered ${res.status}, which the contract does not list`);
  const schema = declared.content?.["application/json"]?.schema;
  if (!schema) return void (await res.body?.cancel());
  const validate = ajv.compile(resolve(schema));
  const body = await res.json();
  if (!validate(body)) throw new Error(`${method.toUpperCase()} ${path} ${res.status}: ${ajv.errorsText(validate.errors)}`);
}

// x-contract-handler (optional) is the same function wired to fixed data, for handlers that read a database; it is never deployed.
const handlerOf = async (op: Json): Promise<(r: Request) => Promise<Response> | Response> => (await import(new URL(op["x-contract-handler"] ?? op["x-handler"], import.meta.url).href)).handler;
// A required query parameter is filled from its example.
const urlOf = (path: string, op: Json): string => {
  const q = new URLSearchParams();
  for (const p of op.parameters ?? []) if (p.in === "query" && p.example !== undefined) q.set(p.name, String(p.example));
  return "https://x.test" + path + (q.size ? "?" + q : "");
};

Deno.test("the contract is OpenAPI 3.1 and every operation names a handler and a 2xx answer", () => {
  assertEquals(spec.openapi.startsWith("3.1"), true);
  for (const [path, item] of Object.entries<Json>(spec.paths)) {
    for (const [method, op] of Object.entries<Json>(item)) {
      assert(op["x-handler"], `${method} ${path} has no x-handler`);
      assert(Object.keys(op.responses).some((c) => c.startsWith("2")), `${method} ${path} has no 2xx response`);
    }
  }
});

Deno.test("every function folder has a path in the contract", async () => {
  const handlers = new Set(Object.values<Json>(spec.paths).flatMap((i) => Object.values<Json>(i).map((o) => String(o["x-handler"]).split("/").slice(-2, -1)[0])));
  for await (const e of Deno.readDir(new URL("../supabase/functions", import.meta.url))) if (e.isDirectory && !e.name.startsWith("_")) assert(handlers.has(e.name), `function ${e.name} is not in api/openapi.yaml`);
});

Deno.test("every operation: the real handler answers what the contract says", async () => {
  for (const [path, item] of Object.entries<Json>(spec.paths)) {
    for (const [method, op] of Object.entries<Json>(item)) {
      const handler = await handlerOf(op);
      await checkAnswer(path, method, await handler(new Request(urlOf(path, op), { method: method.toUpperCase() })));
    }
  }
});

Deno.test("a wrong field is red: a renamed field, an extra field and a wrong type each fail", async () => {
  const answer = (b: Json) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  const good = { ok: true, service: "health", time: new Date().toISOString() };
  await checkAnswer("/health", "get", answer(good));
  await assertRejects(() => checkAnswer("/health", "get", answer({ ok: true, service: "health", tme: good.time })), Error, "/health");
  await assertRejects(() => checkAnswer("/health", "get", answer({ ...good, project: "goserve-dev" })), Error, "additional properties");
  await assertRejects(() => checkAnswer("/health", "get", answer({ ...good, ok: "yes" })), Error);
});

Deno.test("a status code the contract does not list is red", async () => {
  await assertRejects(() => checkAnswer("/health", "get", new Response("{}", { status: 500 })), Error, "does not list");
});

Deno.test("menu: the 400 answer is in the contract, and a wrong field in a dish is red", async () => {
  const { handler } = await import("../supabase/functions/menu/fixture.ts");
  await checkAnswer("/menu", "get", await handler(new Request("https://x.test/menu")));   // no kitchen: 400, listed
  const res = await handler(new Request("https://x.test/menu?kitchen=7e57ab1e-0000-4000-8000-000000000001"));
  const body = await res.json();
  body.categories[0].dishes[0].protein = 18;   // not protein_g
  await assertRejects(() => checkAnswer("/menu", "get", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("quote: the 200, the 422 and the 400 answers are in the contract, and a wrong field in a line is red", async () => {
  const { handler } = await import("../supabase/functions/quote/fixture.ts");
  const post = (b: unknown) => handler(new Request("https://x.test/quote", { method: "POST", body: JSON.stringify(b) }));
  const K = "7e57ab1e-0000-4000-8000-000000000001", D1 = "7e57ab1e-0000-4000-8000-0000000000d1", D2 = "7e57ab1e-0000-4000-8000-0000000000d2";
  const base = { kitchen_id: K, address: { pin_code: "110016" } };
  await checkAnswer("/quote", "post", await post({ ...base, lines: [{ menu_item_id: D1, qty: 2, option_ids: [] }], coupon_code: "FLAT50" }));
  await checkAnswer("/quote", "post", await post({ ...base, lines: [{ menu_item_id: D2, qty: 1, option_ids: [] }] }));   // sold out: 422
  await checkAnswer("/quote", "post", await post({ ...base, lines: "no" }));   // 400
  const body = await (await post({ ...base, lines: [{ menu_item_id: D1, qty: 1, option_ids: [] }] })).json();
  body.lines[0].price = 1;   // not unit_paise
  await assertRejects(() => checkAnswer("/quote", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("serviceability: the in-range, out-of-range and 400 answers are in the contract, and a wrong field in a kitchen is red", async () => {
  const { handler } = await import("../supabase/functions/serviceability/fixture.ts");
  const ask = (q: string) => handler(new Request(`https://x.test/serviceability${q}`));
  await checkAnswer("/serviceability", "get", await ask(""));   // no place: 400, listed
  await checkAnswer("/serviceability", "get", await ask("?lat=28.7&lng=77.5"));   // out of range: 200 with Request here
  const body = await (await ask("?lat=28.5494&lng=77.2001")).json();
  assertEquals(body.kitchens.length, 1);
  body.kitchens[0].eta = 20;   // not eta_min
  await assertRejects(() => checkAnswer("/serviceability", "get", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("orders: the 201, 401, 409, 422 and 400 answers are in the contract, and a wrong field in the order is red", async () => {
  const { handler } = await import("../supabase/functions/orders/fixture.ts");
  const K = "7e57ab1e-0000-4000-8000-000000000001", D1 = "7e57ab1e-0000-4000-8000-0000000000d1", D2 = "7e57ab1e-0000-4000-8000-0000000000d2";
  const body = { kitchen_id: K, lines: [{ menu_item_id: D1, qty: 2, option_ids: [] }], address: { pin_code: "110016", text: "Flat 4, Green Park" }, idempotency_key: "key-0001-abcd", expected_to_pay_paise: 28000 };
  const post = (b: unknown, auth = true) => handler(new Request("https://x.test/orders", { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(b) }));
  const created = await post(body);
  assertEquals(created.status, 201);
  await checkAnswer("/orders", "post", created);
  await checkAnswer("/orders", "post", await post(body, false));   // 401
  await checkAnswer("/orders", "post", await post({ ...body, expected_to_pay_paise: 100 }));   // 409 price_changed with the new quote
  await checkAnswer("/orders", "post", await post({ ...body, lines: [{ menu_item_id: D2, qty: 1, option_ids: [] }] }));   // 422 unknown dish
  await checkAnswer("/orders", "post", await post({ ...body, idempotency_key: "x" }));   // 400
  const ok = await (await post(body)).json();
  ok.order.customer_phone = "9876543210";   // not a field of the order in the contract
  await assertRejects(() => checkAnswer("/orders", "post", new Response(JSON.stringify(ok), { status: 201 })), Error, "additional properties");
});

Deno.test("order-actions: the 200, 401, 409, 422 and 400 answers are in the contract, and a wrong field in the order is red", async () => {
  const { handler } = await import("../supabase/functions/order-actions/fixture.ts");
  const O = "7e57ab1e-0000-4000-8000-0000000000f1";
  const post = (b: unknown, auth = true) => handler(new Request("https://x.test/order-actions", { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(b) }));
  const good = await post({ order_id: O, action: "accept" });
  assertEquals(good.status, 200);
  await checkAnswer("/order-actions", "post", good);
  await checkAnswer("/order-actions", "post", await post({ order_id: O, action: "accept" }, false));   // 401
  await checkAnswer("/order-actions", "post", await post({ order_id: O, action: "deliver" }));   // 409
  await checkAnswer("/order-actions", "post", await post({ order_id: O, action: "cancel" }));   // 422
  await checkAnswer("/order-actions", "post", await post({ order_id: "x", action: "accept" }));   // 400
  const body = await (await post({ order_id: O, action: "accept" })).json();
  body.order.customer_phone = "9876543210";
  await assertRejects(() => checkAnswer("/order-actions", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("otp: send and verify answer 200, 400, 401, 422 and 429 as the contract says, and the code is never in an answer", async () => {
  const { handler } = await import("../supabase/functions/otp/fixture.ts");
  const post = (route: string, b: unknown, auth = true) => handler(new Request(`https://x.test/otp/${route}`, { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(b) }));
  const sent = await post("send", { phone: "9876543210" });
  assertEquals(sent.status, 200);
  const text = await sent.clone().text();
  assertEquals(text.includes("482913"), false);
  await checkAnswer("/otp/send", "post", sent);
  await checkAnswer("/otp/send", "post", await post("send", { phone: "9876543210" }, false));   // 401
  await checkAnswer("/otp/send", "post", await post("send", { phone: "9000000000" }));   // 429
  await checkAnswer("/otp/send", "post", await post("send", {}));   // 400
  const ok = await post("verify", { phone: "9876543210", code: "482913" });
  assertEquals(ok.status, 200);
  await checkAnswer("/otp/verify", "post", ok);
  await checkAnswer("/otp/verify", "post", await post("verify", { phone: "9876543210", code: "000000" }));   // 422
  await checkAnswer("/otp/verify", "post", await post("verify", { phone: "9876543210", code: "1" }));   // 400
  const body = await (await post("verify", { phone: "9876543210", code: "482913" })).json();
  body.session = "x";   // not a field of the answer
  await assertRejects(() => checkAnswer("/otp/verify", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("payments: create and webhook answer 200, 400, 401, 404 as the contract says; a bad signature is 400 and a wrong field is red", async () => {
  const { handler, CONTRACT_SECRET } = await import("../supabase/functions/payments/fixture.ts");
  const { sign } = await import("../supabase/functions/payments/index.ts");
  const O = "7e57ab1e-0000-4000-8000-0000000000f1";
  const post = (route: string, b: unknown, auth = true) => handler(new Request(`https://x.test/payments/${route}`, { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(b) }));
  const created = await post("create", { order_id: O });
  assertEquals(created.status, 200);
  await checkAnswer("/payments/create", "post", created);
  await checkAnswer("/payments/create", "post", await post("create", { order_id: O }, false));   // 401
  await checkAnswer("/payments/create", "post", await post("create", { order_id: "7e57ab1e-0000-4000-8000-00000000dead" }));   // 404
  await checkAnswer("/payments/create", "post", await post("create", { order_id: "x" }));   // 400
  const good = { provider_order_id: "fake_order_1", provider_payment_id: "fake_pay_1", signature: await sign(CONTRACT_SECRET, "fake_order_1", "fake_pay_1") };
  const paid = await post("webhook", good, false);
  assertEquals(paid.status, 200);
  await checkAnswer("/payments/webhook", "post", paid);
  await checkAnswer("/payments/webhook", "post", await post("webhook", { ...good, signature: "0".repeat(64) }, false));   // 400
  await checkAnswer("/payments/webhook", "post", await post("webhook", { ...good, provider_order_id: "unknown", signature: await sign(CONTRACT_SECRET, "unknown", "fake_pay_1") }, false));   // 404
  const body = await (await post("create", { order_id: O })).json();
  body.key_secret = "x";   // a gateway key must never be a field of the answer
  await assertRejects(() => checkAnswer("/payments/create", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("otp claim: the returning customer's answers are in the contract (200, 401, 403, 409) and a wrong field is red", async () => {
  const { handler } = await import("../supabase/functions/otp/fixture.ts");
  const post = (b: unknown, token: string | null) => handler(new Request("https://x.test/otp/claim", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(b) }));
  const ok = await post({ guest_token: "guest-tok" }, "old-tok");
  assertEquals(ok.status, 200);
  await checkAnswer("/otp/claim", "post", ok);
  await checkAnswer("/otp/claim", "post", await post({ guest_token: "guest-tok" }, null));   // 401
  await checkAnswer("/otp/claim", "post", await post({ guest_token: "guest-tok" }, "guest-tok"));   // 403
  await checkAnswer("/otp/claim", "post", await post({ guest_token: "old-tok" }, "old-tok"));   // 409
  await checkAnswer("/otp/claim", "post", await post({}, "old-tok"));   // 400
  const body = await (await post({ guest_token: "guest-tok" }, "old-tok")).json();
  body.session = "x";
  await assertRejects(() => checkAnswer("/otp/claim", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("push: register and notify answer 200, 400, 401, 404 as the contract says and a wrong field is red", async () => {
  const { handler, CONTRACT_SECRET } = await import("../supabase/functions/push/fixture.ts");
  const O = "7e57ab1e-0000-4000-8000-0000000000f1";
  const post = (route: string, b: unknown, headers: Record<string, string>) => handler(new Request(`https://x.test/push/${route}`, { method: "POST", headers, body: JSON.stringify(b) }));
  const reg = await post("register", { platform: "android", token: "tok-a" }, { authorization: "Bearer t" });
  assertEquals(reg.status, 200);
  await checkAnswer("/push/register", "post", reg);
  await checkAnswer("/push/register", "post", await post("register", { platform: "android", token: "tok-a" }, {}));   // 401
  await checkAnswer("/push/register", "post", await post("register", { platform: "windows", token: "x" }, { authorization: "Bearer t" }));   // 400
  const sec = { "x-push-secret": CONTRACT_SECRET };
  const sent = await post("notify", { order_id: O }, sec);
  assertEquals(sent.status, 200);
  await checkAnswer("/push/notify", "post", sent);
  await checkAnswer("/push/notify", "post", await post("notify", { order_id: O }, { "x-push-secret": "nope" }));   // 401
  await checkAnswer("/push/notify", "post", await post("notify", { order_id: "x" }, sec));   // 400
  await checkAnswer("/push/notify", "post", await post("notify", { order_id: "7e57ab1e-0000-4000-8000-00000000dead" }, sec));   // 404
  const body = await (await post("notify", { order_id: O }, sec)).json();
  body.token = "x";   // a device token must never be a field of the answer
  await assertRejects(() => checkAnswer("/push/notify", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("payments: switch-to-cash answers 200, 401, 404, 409 as the contract says and a wrong field is red", async () => {
  const { handler } = await import("../supabase/functions/payments/fixture.ts");
  const post = (b: unknown, auth = true) => handler(new Request("https://x.test/payments/switch-to-cash", { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(b) }));
  const O = "7e57ab1e-0000-4000-8000-0000000000f1";
  const ok = await post({ order_id: O });
  assertEquals(ok.status, 200);
  await checkAnswer("/payments/switch-to-cash", "post", ok);
  await checkAnswer("/payments/switch-to-cash", "post", await post({ order_id: O }, false));   // 401
  await checkAnswer("/payments/switch-to-cash", "post", await post({ order_id: "7e57ab1e-0000-4000-8000-00000000dead" }));   // 404
  await checkAnswer("/payments/switch-to-cash", "post", await post({ order_id: "7e57ab1e-0000-4000-8000-0000000000f9" }));   // 409
  await checkAnswer("/payments/switch-to-cash", "post", await post({ order_id: "x" }));   // 400
  const body = await (await post({ order_id: O })).json();
  body.token = "x";
  await assertRejects(() => checkAnswer("/payments/switch-to-cash", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("coupons: GET /coupons answers 200 as the contract says and a wrong field is red; the quote carries its offers", async () => {
  const { handler } = await import("../supabase/functions/coupons/fixture.ts");
  const ok = await handler(new Request("https://x.test/coupons"));
  assertEquals(ok.status, 200);
  await checkAnswer("/coupons", "get", ok);
  const body = await (await handler(new Request("https://x.test/coupons"))).json();
  body.coupons[0].secret = "x";
  await assertRejects(() => checkAnswer("/coupons", "get", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
  const { handler: quote } = await import("../supabase/functions/quote/fixture.ts");
  const q = await (await quote(new Request("https://x.test/quote", { method: "POST", body: JSON.stringify({ kitchen_id: "7e57ab1e-0000-4000-8000-000000000001", lines: [{ menu_item_id: "7e57ab1e-0000-4000-8000-0000000000d1", qty: 1 }], address: { pin_code: "110016" } }) }))).json();
  assertEquals(q.offers, [{ code: "FLAT50", title: "Rs 50 off", saves_paise: 5000 }]);
});

Deno.test("rating: POST /orders/{id}/rating answers 200, 400, 401, 404, 409 as the contract says and a wrong field is red", async () => {
  const { handler } = await import("../supabase/functions/orders/fixture.ts");
  const post = (id: string, b: unknown, auth = true) => handler(new Request(`https://x.test/orders/${id}/rating`, { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(b) }));
  const O = "7e57ab1e-0000-4000-8000-0000000000f1";
  const ok = await post(O, { food_score: 5, rider_score: 4, comment: "Hot" });
  assertEquals(ok.status, 200);
  await checkAnswer("/orders/{id}/rating", "post", ok);
  await checkAnswer("/orders/{id}/rating", "post", await post(O, { food_score: 5 }, false));   // 401
  await checkAnswer("/orders/{id}/rating", "post", await post(O, { food_score: "5" }));   // 400
  await checkAnswer("/orders/{id}/rating", "post", await post("7e57ab1e-0000-4000-8000-00000000dead", { food_score: 5 }));   // 404
  await checkAnswer("/orders/{id}/rating", "post", await post("7e57ab1e-0000-4000-8000-0000000000f2", { food_score: 5 }));   // 409
  const body = await (await post(O, { food_score: 5 })).json();
  body.score = 5;
  await assertRejects(() => checkAnswer("/orders/{id}/rating", "post", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});

Deno.test("me: GET, PATCH and DELETE /me answer as the contract says and a wrong field is red", async () => {
  const { handler } = await import("../supabase/functions/me/fixture.ts");
  const call = (method: string, b?: unknown, auth = true) => handler(new Request("https://x.test/me", { method, headers: auth ? { authorization: "Bearer t" } : {}, body: b === undefined ? undefined : JSON.stringify(b) }));
  const got = await call("GET");
  assertEquals(got.status, 200);
  await checkAnswer("/me", "get", got);
  await checkAnswer("/me", "get", await call("GET", undefined, false));   // 401
  const saved = await call("PATCH", { name: "Asha K" });
  assertEquals(saved.status, 200);
  await checkAnswer("/me", "patch", saved);
  await checkAnswer("/me", "patch", await call("PATCH", {}));   // 400
  await checkAnswer("/me", "patch", await call("PATCH", { name: "Gone" }));   // 410
  await checkAnswer("/me", "patch", await call("PATCH", { name: "x".repeat(81) }));   // 422
  const del = await call("DELETE");
  assertEquals(del.status, 200);
  await checkAnswer("/me", "delete", del);
  const body = await (await call("GET")).json();
  body.profile.phone = "x";   // a phone is not part of the profile
  await assertRejects(() => checkAnswer("/me", "get", new Response(JSON.stringify(body), { status: 200 })), Error, "additional properties");
});
