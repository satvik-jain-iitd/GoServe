// Story #340: GET /me, PATCH /me and DELETE /me. The data sources are injected, so these tests need no network.
// Scenario: Given a signed-in customer, when they delete the account, then their data is soft-deleted and purged by a job.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";

const calls: unknown[][] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  session: async (req) => (req.headers.get("authorization") ? "u1" : null),
  get: async (u) => { calls.push(["get", u]); return { ok: true, profile: { name: "Asha", email: "asha@example.com" } }; },
  set: async (...a) => { calls.push(["set", ...a]); return { ok: true }; },
  remove: async (u) => { calls.push(["remove", u]); return { ok: true }; }, ...o,
});
const call = (h: ReturnType<typeof makeHandler>, method: string, b?: unknown, token: string | null = "t") =>
  h(new Request("https://x.test/me", { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }));

Deno.test("GET /me answers the caller's own name and email", async () => {
  calls.length = 0;
  const res = await call(makeHandler(deps()), "GET");
  assertEquals([res.status, await res.json()], [200, { ok: true, profile: { name: "Asha", email: "asha@example.com" } }]);
  assertEquals(calls, [["get", "u1"]]);
});

Deno.test("PATCH /me saves what was sent for the caller, trimmed by the database; a field left out is passed as null", async () => {
  calls.length = 0;
  assertEquals((await call(makeHandler(deps()), "PATCH", { name: "Asha K" })).status, 200);
  assertEquals((await call(makeHandler(deps()), "PATCH", { email: "" })).status, 200);
  assertEquals(calls, [["set", "u1", "Asha K", null], ["set", "u1", null, ""]]);
});

Deno.test("DELETE /me soft-deletes the caller's account (the scenario)", async () => {
  calls.length = 0;
  const res = await call(makeHandler(deps()), "DELETE");
  assertEquals([res.status, await res.json()], [200, { ok: true }]);
  assertEquals(calls, [["remove", "u1"]]);
});

Deno.test("no login is 401 on every method and nothing is read or written", async () => {
  calls.length = 0;
  for (const m of ["GET", "PATCH", "DELETE"]) assertEquals((await call(makeHandler(deps()), m, m === "PATCH" ? { name: "A" } : undefined, null)).status, 401, m);
  assertEquals(calls, []);
});

Deno.test("refusals keep their code: a deleted account is 410, a bad name or email is 422", async () => {
  const gone = makeHandler(deps({ get: async () => ({ ok: false, error: "account_deleted", message: "m" }), set: async () => ({ ok: false, error: "account_deleted", message: "m" }) }));
  assertEquals([(await call(gone, "GET")).status, (await call(gone, "PATCH", { name: "A" })).status], [410, 410]);
  for (const error of ["invalid_name", "invalid_email"]) {
    const res = await call(makeHandler(deps({ set: async () => ({ ok: false, error, message: "m" }) })), "PATCH", { name: "A" });
    assertEquals([res.status, (await res.json()).error], [422, error]);
  }
});

Deno.test("a PATCH that is not an object of text fields, or has none, is 400", async () => {
  for (const b of [{}, null, [], { name: 5 }, { email: {} }, { other: "x" }, "x"]) assertEquals((await call(makeHandler(deps()), "PATCH", b)).status, 400, JSON.stringify(b));
});

Deno.test("a dead database is 502 with no detail; other methods are 405", async () => {
  const dead = makeHandler(deps({ get: () => Promise.reject(new Error("host=10.0.0.1")) }));
  const res = await call(dead, "GET");
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "me_unavailable" }]);
  const post = await call(makeHandler(deps()), "POST", {});
  assertEquals([post.status, post.headers.get("allow")], [405, "GET, PATCH, DELETE"]);
});
