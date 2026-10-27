// Story #349: POST /order-actions. One door for every step an order takes after it is placed. The login decides who may do what (in the database);
// this handler checks the request, passes the caller's own token on, and maps the answer to a status code. Injected, so no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";

const O = "7e57ab1e-0000-4000-8000-0000000000f1";
const calls: unknown[][] = [];
const order = { id: O, kitchen_id: "k", status: "accepted", total_paise: 28000, address: "Flat 4", items: [], bill: {}, created_at: "2026-10-27T10:00:00Z", customer_phone: "9876543210" };
const deps = (act?: Deps["act"]): Deps => ({ act: act ?? (async (...a) => { calls.push(a); return { ok: true, order }; }) });
const post = (h: ReturnType<typeof makeHandler>, b: unknown, opts: { method?: string; token?: string | null } = {}) =>
  h(new Request("https://x.test/order-actions", { method: opts.method ?? "POST", headers: { "content-type": "application/json", ...(opts.token === null ? {} : { authorization: `Bearer ${opts.token ?? "t"}` }) }, body: (opts.method ?? "POST") === "POST" ? JSON.stringify(b) : undefined }));
const ok = { order_id: O, action: "accept" };

Deno.test("a step answers 200 with the order, and the caller's own token goes to the database", async () => {
  calls.length = 0;
  const res = await post(makeHandler(deps()), ok, { token: "tok-1" });
  assertEquals(res.status, 200);
  const o = await res.json();
  assertEquals([o.ok, o.order.status, "customer_phone" in o.order], [true, "accepted", false]);   // only the fields the contract lists
  assertEquals(calls[0], ["tok-1", O, "accept", null]);
});

Deno.test("cancel passes the reason on", async () => {
  calls.length = 0;
  await post(makeHandler(deps()), { order_id: O, action: "cancel", reason: "out of rice" });
  assertEquals(calls[0], ["t", O, "cancel", "out of rice"]);
});

Deno.test("each refusal has its status: 401, 403, 404, 409 and 422", async () => {
  const refuse = (error: string) => makeHandler(deps(async () => ({ ok: false, error, message: "m" })));
  for (const [error, status] of [["unauthorized", 401], ["not_allowed", 403], ["order_not_found", 404], ["already_done", 409], ["illegal_step", 409], ["cannot_cancel", 409], ["reason_required", 422], ["order_action_failed", 500]] as const) {
    const res = await post(refuse(error), ok);
    assertEquals([error, res.status, (await res.json()).error], [error, status, error]);
  }
});

Deno.test("no token is 401 and the database is never asked", async () => {
  calls.length = 0;
  const res = await post(makeHandler(deps()), ok, { token: null });
  assertEquals([res.status, (await res.json()).error, calls.length], [401, "unauthorized", 0]);
});

Deno.test("a malformed request is 400 invalid_request: bad order id, unknown action, reason too long, not JSON", async () => {
  const h = makeHandler(deps());
  for (const b of [{ ...ok, order_id: "x" }, { ...ok, action: "fly" }, { ...ok, action: undefined }, { ...ok, action: "cancel", reason: "x".repeat(201) }, { ...ok, reason: 5 }]) {
    const res = await post(h, b);
    assertEquals([res.status, (await res.json()).error], [400, "invalid_request"]);
  }
  assertEquals((await h(new Request("https://x.test/order-actions", { method: "POST", headers: { authorization: "Bearer t" }, body: "{nope" }))).status, 400);
});

Deno.test("when the database fails the answer is 502 order_action_unavailable and no detail leaks", async () => {
  const res = await post(makeHandler(deps(() => Promise.reject(new Error("password=secret")))), ok);
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "order_action_unavailable" }]);
});

Deno.test("anything but POST is 405", async () => {
  const res = await post(makeHandler(deps()), null, { method: "GET" });
  assertEquals([res.status, res.headers.get("allow")], [405, "POST"]);
});

Deno.test("cancel: after a successful cancel the refund step runs once, and a failing refund never fails the cancel (#348)", async () => {
  const refunded: string[] = [];
  const ok = makeHandler({ ...deps(), refundAfterCancel: async (id) => { refunded.push(id); } });
  assertEquals((await post(ok, { order_id: O, action: "cancel", reason: "x" })).status, 200);
  assertEquals(refunded, [O]);
  await post(ok, { order_id: O, action: "accept" });
  assertEquals(refunded.length, 1);   // only a cancel refunds
  const broken = makeHandler({ ...deps(), refundAfterCancel: () => Promise.reject(new Error("gateway down")) });
  assertEquals((await post(broken, { order_id: O, action: "cancel", reason: "x" })).status, 200);
  const refused = makeHandler({ ...deps(async () => ({ ok: false, error: "cannot_cancel", message: "m" })), refundAfterCancel: async (id) => { refunded.push(id); } });
  assertEquals((await post(refused, { order_id: O, action: "cancel", reason: "x" })).status, 409);
  assertEquals(refunded.length, 1);   // a refused cancel refunds nothing
});
