// Story #351: POST /push/register and POST /push/notify, built with a TEST DOUBLE (FakePush) until the owner's FCM and Apple Developer clicks.
// Scenario: Given a device token, when an order changes, then a push is sent to Android or iOS. Everything is in process, no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { FakePush } from "../_shared/push.ts";

const O = "7e57ab1e-0000-4000-8000-0000000000f1";
const SECRET = "test-notify-secret";
let fake: FakePush;
const saved: unknown[][] = [];
const forgotten: string[] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  session: async (req) => (req.headers.get("authorization") ? "u1" : null),
  push: fake,
  register: async (...a) => { saved.push(a); return { ok: true }; },
  job: async () => ({ ok: true, status: "accepted", devices: [{ platform: "android", token: "tok-a" }, { platform: "ios", token: "tok-i" }] }),
  forget: async (t) => { forgotten.push(t); },
  secret: () => SECRET, ...o,
});
const post = (h: ReturnType<typeof makeHandler>, route: string, b: unknown, headers: Record<string, string> = { authorization: "Bearer t" }, method = "POST") =>
  h(new Request(`https://x.test/push/${route}`, { method, headers: { "content-type": "application/json", ...headers }, body: method === "POST" ? JSON.stringify(b) : undefined }));
const reset = () => { fake = new FakePush(); saved.length = 0; forgotten.length = 0; };

Deno.test("register: a signed-in device is saved with its platform", async () => {
  reset();
  const res = await post(makeHandler(deps()), "register", { platform: "ios", token: "tok-i" });
  assertEquals([res.status, (await res.json()).ok], [200, true]);
  assertEquals(saved, [["u1", "ios", "tok-i"]]);
});

Deno.test("register: no login is 401, a bad body is 400, a refusal keeps its code, a dead database is 502 with no detail", async () => {
  reset();
  assertEquals((await post(makeHandler(deps()), "register", { platform: "ios", token: "t" }, {})).status, 401);
  for (const b of [{}, { platform: "windows", token: "t" }, { platform: "ios", token: "" }, { platform: "ios", token: 5 }]) {
    assertEquals((await post(makeHandler(deps()), "register", b)).status, 400, JSON.stringify(b));
  }
  const refused = await post(makeHandler(deps({ register: async () => ({ ok: false, error: "invalid_request", message: "m" }) })), "register", { platform: "ios", token: "t" });
  assertEquals(refused.status, 400);
  const dead = await post(makeHandler(deps({ register: async () => { throw new Error("db host 10.0.0.1 down"); } })), "register", { platform: "ios", token: "t" });
  assertEquals([dead.status, JSON.stringify(await dead.json()).includes("10.0.0.1")], [502, false]);
  assertEquals(saved.length, 0);
});

Deno.test("notify: every device of the order gets a push that says the order status", async () => {
  reset();
  const res = await post(makeHandler(deps()), "notify", { order_id: O }, { "x-push-secret": SECRET });
  assertEquals(res.status, 200);
  assertEquals((await res.json()).sent, 2);
  assertEquals(fake.sent.map((s) => [s.platform, s.token, s.title, s.body]), [
    ["android", "tok-a", "GoServe", "The kitchen accepted your order."],
    ["ios", "tok-i", "GoServe", "The kitchen accepted your order."],
  ]);
});

Deno.test("notify: a wrong or missing secret is 401 and nothing is sent; an unset secret is 503", async () => {
  reset();
  for (const h of [{} as Record<string, string>, { "x-push-secret": "nope" }]) {
    assertEquals((await post(makeHandler(deps()), "notify", { order_id: O }, h)).status, 401);
  }
  assertEquals((await post(makeHandler(deps({ secret: () => "" })), "notify", { order_id: O }, { "x-push-secret": "" })).status, 503);
  assertEquals(fake.sent.length, 0);
});

Deno.test("notify: a token the push service says is gone is forgotten; other failures are counted, not hidden", async () => {
  reset();
  fake.gone.add("tok-a"); fake.broken.add("tok-i");
  const res = await post(makeHandler(deps()), "notify", { order_id: O }, { "x-push-secret": SECRET });
  const o = await res.json();
  assertEquals([res.status, o.sent, o.failed, o.forgotten], [200, 0, 1, 1]);
  assertEquals(forgotten, ["tok-a"]);
});

Deno.test("notify: an unknown order is 404, a bad order id is 400, no device is a quiet 200", async () => {
  reset();
  const h = { "x-push-secret": SECRET };
  assertEquals((await post(makeHandler(deps({ job: async () => ({ ok: false, error: "order_not_found", message: "m" }) })), "notify", { order_id: O }, h)).status, 404);
  assertEquals((await post(makeHandler(deps()), "notify", { order_id: "x" }, h)).status, 400);
  const none = await post(makeHandler(deps({ job: async () => ({ ok: true, status: "placed", devices: [] }) })), "notify", { order_id: O }, h);
  assertEquals([none.status, (await none.json()).sent], [200, 0]);
});

Deno.test("other methods and routes: 405 and 404", async () => {
  reset();
  assertEquals((await post(makeHandler(deps()), "register", null, {}, "GET")).status, 405);
  assertEquals((await post(makeHandler(deps()), "nope", {})).status, 404);
});
