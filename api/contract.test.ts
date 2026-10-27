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

const handlerOf = async (op: Json): Promise<(r: Request) => Promise<Response> | Response> => (await import(new URL(op["x-handler"], import.meta.url).href)).handler;

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
      await checkAnswer(path, method, await handler(new Request("https://x.test" + path, { method: method.toUpperCase() })));
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
