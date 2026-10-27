// Story #468: GET /staff/mine, POST /staff and DELETE /staff. One person can work in several kitchens. The data sources are injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";

const KA = "7e57ab1e-0000-4000-8000-0000000000b1", KB = "7e57ab1e-0000-4000-8000-0000000000b2", U = "7e57ab1e-0000-4000-8000-0000000000c1";
const calls: unknown[][] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  session: async (req) => (req.headers.get("authorization") ? "admin1" : null),
  mine: async (u) => { calls.push(["mine", u]); return { ok: true, kitchens: [{ kitchen_id: KA, name: "A", role: "owner" }, { kitchen_id: KB, name: "B", role: "staff" }] }; },
  add: async (...a) => { calls.push(["add", ...a]); return { ok: true }; },
  remove: async (...a) => { calls.push(["remove", ...a]); return { ok: true }; }, ...o,
});
const call = (h: ReturnType<typeof makeHandler>, method: string, path: string, b?: unknown, token: string | null = "t") =>
  h(new Request(`https://x.test/staff${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }));

Deno.test("GET /staff/mine lists both kitchens of the caller with their roles (the scenario)", async () => {
  calls.length = 0;
  const res = await call(makeHandler(deps()), "GET", "/mine");
  const o = await res.json();
  assertEquals([res.status, o.ok, o.kitchens.map((k: { role: string }) => k.role)], [200, true, ["owner", "staff"]]);
  assertEquals(calls, [["mine", "admin1"]]);
});

Deno.test("POST /staff adds one membership as the calling admin; DELETE /staff removes one", async () => {
  calls.length = 0;
  assertEquals((await call(makeHandler(deps()), "POST", "", { kitchen_id: KB, user_id: U, role: "staff" })).status, 200);
  assertEquals((await call(makeHandler(deps()), "DELETE", "", { kitchen_id: KB, user_id: U })).status, 200);
  assertEquals(calls, [["add", "admin1", KB, U, "staff"], ["remove", "admin1", KB, U]]);
});

Deno.test("refusals keep their code: not an admin is 403; a kitchen, person or membership that is not there is 404; a bad role is 422", async () => {
  for (const [error, status] of [["not_allowed", 403], ["kitchen_not_found", 404], ["user_not_found", 404], ["membership_not_found", 404], ["invalid_role", 422]] as const) {
    const add = await call(makeHandler(deps({ add: async () => ({ ok: false, error, message: "m" }) })), "POST", "", { kitchen_id: KB, user_id: U, role: "staff" });
    assertEquals([error, add.status, (await add.json()).error], [error, status, error]);
    const rm = await call(makeHandler(deps({ remove: async () => ({ ok: false, error, message: "m" }) })), "DELETE", "", { kitchen_id: KB, user_id: U });
    assertEquals([error, rm.status], [error, status]);
  }
});

Deno.test("no login is 401 on every route and nothing is read or written", async () => {
  calls.length = 0;
  for (const [m, p, b] of [["GET", "/mine", undefined], ["POST", "", { kitchen_id: KB, user_id: U, role: "staff" }], ["DELETE", "", { kitchen_id: KB, user_id: U }]] as const) {
    assertEquals((await call(makeHandler(deps()), m, p, b, null)).status, 401, m);
  }
  assertEquals(calls, []);
});

Deno.test("a bad body is 400: ids that are not ids, a role that is not text, a missing field", async () => {
  const h = makeHandler(deps());
  for (const b of [{}, { kitchen_id: "x", user_id: U, role: "staff" }, { kitchen_id: KB, user_id: "y", role: "staff" }, { kitchen_id: KB, user_id: U }, { kitchen_id: KB, user_id: U, role: 5 }, null]) {
    assertEquals((await call(h, "POST", "", b)).status, 400, JSON.stringify(b));
  }
  assertEquals((await call(h, "DELETE", "", { kitchen_id: KB })).status, 400);
});

Deno.test("a dead database is 502 with no detail; other routes are 404 and other methods 405", async () => {
  const dead = await call(makeHandler(deps({ mine: () => Promise.reject(new Error("host=10.0.0.1")) })), "GET", "/mine");
  assertEquals([dead.status, await dead.json()], [502, { ok: false, error: "staff_unavailable" }]);
  assertEquals((await call(makeHandler(deps()), "GET", "/other")).status, 404);
  const put = await call(makeHandler(deps()), "PUT", "", {});
  assertEquals([put.status, put.headers.get("allow")], [405, "GET, POST, DELETE"]);
});
