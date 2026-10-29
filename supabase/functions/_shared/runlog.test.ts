// Story #356 (E27, plan v2 B.20). Scenario: Given a call that fails, when the log is read, then the row has the error and a request id.
// withRunLog wraps a handler: one run_log row per call, a request id on the answer, and a log that can never break the answer. Injected writer, no network.
import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { withRunLog, type Row } from "./runlog.ts";

const rows: Row[] = [];
const write = async (r: Row) => { rows.push(r); };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const call = (h: (r: Request) => Promise<Response>, headers: Record<string, string> = {}) => h(new Request("https://x.test/quote", { method: "POST", headers, body: JSON.stringify({ secret: "do-not-log" }) }));

Deno.test("a good call leaves one row with the function, the status, the time and a request id, and the answer carries the same id", async () => {
  rows.length = 0;
  const res = await call(withRunLog("quote", async () => json(200, { ok: true }), write));
  assertEquals(res.status, 200);
  const id = res.headers.get("x-request-id")!;
  assertMatch(id, /^[0-9a-f-]{36}$/);
  assertEquals(rows.length, 1);
  assertEquals([rows[0].workflow, rows[0].status, rows[0].request_id, rows[0].error], ["fn:quote", 200, id, null]);
  assertEquals(typeof rows[0].duration_ms, "number");
});

Deno.test("a failing call leaves a row with the error code and the request id (the scenario)", async () => {
  rows.length = 0;
  const res = await call(withRunLog("orders", async () => json(409, { ok: false, error: "price_changed", message: "A price changed." }), write));
  assertEquals([rows[0].status, rows[0].error, rows[0].request_id], [409, "price_changed", res.headers.get("x-request-id")]);
});

Deno.test("a 5xx with no code, and a thrown error, are logged and the thrown one answers 500 with the id and no detail", async () => {
  rows.length = 0;
  await call(withRunLog("menu", async () => new Response("boom", { status: 502 }), write));
  assertEquals([rows[0].status, rows[0].error], [502, "http_502"]);
  rows.length = 0;
  const res = await call(withRunLog("menu", async () => { throw new Error("password=secret"); }, write));
  assertEquals([res.status, await res.json()], [500, { ok: false, error: "internal_error" }]);
  assertEquals([rows[0].status, rows[0].error, rows[0].request_id], [500, "exception", res.headers.get("x-request-id")]);
});

Deno.test("an id sent by the caller is kept when it is short and plain, and replaced when it is not", async () => {
  rows.length = 0;
  const kept = await call(withRunLog("quote", async () => json(200, {}), write), { "x-request-id": "app-123_abc" });
  assertEquals(kept.headers.get("x-request-id"), "app-123_abc");
  const replaced = await call(withRunLog("quote", async () => json(200, {}), write), { "x-request-id": "x".repeat(200) });
  assertMatch(replaced.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/);
  const odd = await call(withRunLog("quote", async () => json(200, {}), write), { "x-request-id": "a b;drop" });
  assertMatch(odd.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/);
});

Deno.test("the log never holds the request body, the message or any answer text", async () => {
  rows.length = 0;
  await call(withRunLog("orders", async () => json(422, { ok: false, error: "sold_out", message: "Thali is sold out." }), write));
  assertEquals(JSON.stringify(rows).includes("do-not-log"), false);
  assertEquals(JSON.stringify(rows).includes("Thali"), false);
});

Deno.test("a log write that fails or hangs never breaks or delays the answer", async () => {
  const bad = await call(withRunLog("quote", async () => json(200, { ok: true }), () => Promise.reject(new Error("db down"))));
  assertEquals([bad.status, (await bad.json()).ok], [200, true]);
  const slow = await call(withRunLog("quote", async () => json(200, { ok: true }), () => new Promise(() => {})));
  assertEquals(slow.status, 200);
});

Deno.test("the answer body is still readable after the wrapper looked at the error code", async () => {
  const res = await call(withRunLog("quote", async () => json(422, { ok: false, error: "sold_out", message: "m" }), write));
  assertEquals((await res.json()).message, "m");
});

Deno.test("every function except health is wrapped, so every call leaves a row", async () => {
  const wrapped: string[] = [];
  for await (const e of Deno.readDir(new URL("..", import.meta.url))) {
    if (!e.isDirectory || e.name.startsWith("_") || e.name === "health") continue;   // health is pinged every minute: a row each would bury the real calls
    const src = await Deno.readTextFile(new URL(`../${e.name}/index.ts`, import.meta.url));
    if (!src.includes(`withRunLog("${e.name}"`)) wrapped.push(e.name);
  }
  assertEquals(wrapped, []);   // the names of the functions that are NOT wrapped
});
