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
