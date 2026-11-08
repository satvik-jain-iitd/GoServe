// Story #351: POST /push/register and POST /push/notify, built with a TEST DOUBLE (FakePush) until the owner's FCM and Apple Developer clicks.
// Scenario: Given a device token, when an order changes, then a push is sent to Android or iOS. Everything is in process, no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { FakePush } from "../_shared/push.ts";
import type { WebDeps, WebJob } from "./index.ts";

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

// Story #1067: POST /push/web, the database's immediate ask for one outbox row.
const sentWeb: { endpoint: string; payload: unknown }[] = [];
const webLog: string[] = [];
const JOB: WebJob = { ok: true, done: false, subscriptions: [
  { endpoint: "https://p.example/a", p256dh: "k1", auth: "a1", message: { title: "GoServe", body: "Your order is ready.", order_id: "o1", status: "ready" } },
  { endpoint: "https://p.example/b", p256dh: "k2", auth: "a2", message: null },
] };
const web = (o: Partial<WebDeps> = {}, status: Record<string, number> = {}): WebDeps => ({
  send: async (s, payload) => { sentWeb.push({ endpoint: s.endpoint, payload: JSON.parse(payload) }); return { status: status[s.endpoint] ?? 201 }; },
  job: async (id) => { webLog.push(`job ${id}`); return JOB; },
  forget: async (e) => { webLog.push(`forget ${e}`); },
  done: async (id, sent, failed) => { webLog.push(`done ${id} ${sent} ${failed}`); },
  ...o,
});
const resetWeb = () => { sentWeb.length = 0; webLog.length = 0; };
const SEC = { "x-push-secret": SECRET };

Deno.test("web: every subscription gets one push with the words inside (a generic line when there are none), then the row is reported", async () => {
  resetWeb();
  const res = await post(makeHandler(deps({ web: web() })), "web", { outbox_id: 7 }, SEC);
  assertEquals([res.status, await res.json()], [200, { ok: true, sent: 2, failed: 0, forgotten: 0 }]);
  assertEquals(sentWeb, [
    { endpoint: "https://p.example/a", payload: { title: "GoServe", body: "Your order is ready.", order_id: "o1", status: "ready" } },
    { endpoint: "https://p.example/b", payload: { title: "GoServe", body: "Your order has an update.", order_id: null, status: null } },
  ]);
  assertEquals(webLog, ["job 7", "done 7 2 0"]);
});

Deno.test("web: a dead subscription (404 or 410) is forgotten, another failure is counted and the row is not marked sent when nothing went out", async () => {
  resetWeb();
  const gone = await post(makeHandler(deps({ web: web({}, { "https://p.example/a": 410, "https://p.example/b": 404 }) })), "web", { outbox_id: 7 }, SEC);
  assertEquals(await gone.json(), { ok: true, sent: 0, failed: 0, forgotten: 2 });
  assertEquals(webLog, ["job 7", "forget https://p.example/a", "forget https://p.example/b", "done 7 0 0"]);
  resetWeb();
  const bad = await post(makeHandler(deps({ web: web({}, { "https://p.example/a": 500, "https://p.example/b": 429 }) })), "web", { outbox_id: 7 }, SEC);
  assertEquals(await bad.json(), { ok: true, sent: 0, failed: 2, forgotten: 0 });
  assertEquals(webLog, ["job 7", "done 7 0 2"]);
  resetWeb();
  const thrown = await post(makeHandler(deps({ web: web({ send: async () => { throw new Error("network down"); } }) })), "web", { outbox_id: 7 }, SEC);
  assertEquals((await thrown.json()).failed, 2);
});

Deno.test("web: a row already sent or claimed by the retry sends nothing", async () => {
  resetWeb();
  const res = await post(makeHandler(deps({ web: web({ job: async () => ({ ok: true, done: true, subscriptions: [] }) }) })), "web", { outbox_id: 7 }, SEC);
  assertEquals(await res.json(), { ok: true, skipped: true });
  assertEquals(sentWeb, []);
  assertEquals(webLog, []);   // no done call: the row is not touched
});

Deno.test("web: no secret header is 401, a bad id is 400, missing VAPID secrets is 503 and claims nothing, a dead database is 502 with no detail", async () => {
  resetWeb();
  assertEquals((await post(makeHandler(deps({ web: web() })), "web", { outbox_id: 7 }, {})).status, 401);
  for (const b of [{}, { outbox_id: "7" }, { outbox_id: 0 }, { outbox_id: 1.5 }, { outbox_id: null }]) assertEquals((await post(makeHandler(deps({ web: web() })), "web", b, SEC)).status, 400, JSON.stringify(b));
  const off = await post(makeHandler(deps({ web: web({ send: null }) })), "web", { outbox_id: 7 }, SEC);
  assertEquals([off.status, (await off.json()).error], [503, "web_not_configured"]);
  assertEquals(webLog, []);   // the row was not claimed
  const dead = await post(makeHandler(deps({ web: web({ job: async () => { throw new Error("db host 10.0.0.1 down"); } }) })), "web", { outbox_id: 7 }, SEC);
  assertEquals([dead.status, JSON.stringify(await dead.json()).includes("10.0.0.1")], [502, false]);
  assertEquals((await post(makeHandler(deps({ web: web() })), "web", { outbox_id: 7 }, SEC, "GET")).status, 405);
});
