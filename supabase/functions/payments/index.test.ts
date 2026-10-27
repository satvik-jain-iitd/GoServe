// Story #348: POST /payments/create and POST /payments/webhook, built with a TEST DOUBLE (FakeGateway) until the owner's Razorpay KYC click.
// The webhook checks an HMAC-SHA256 signature over `provider_order_id|provider_payment_id` with OUR secret (the Razorpay shape): a bad one is 400 and writes
// nothing. The state is in the database (scripts/test_payments.py); the gateway is an injected dep. Everything is in process, no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, sign, type Deps } from "./index.ts";
import { FakeGateway } from "../_shared/gateway.ts";

const O = "7e57ab1e-0000-4000-8000-0000000000f1";
const SECRET = "test-webhook-secret";
let gw: FakeGateway;
const stored: unknown[][] = [];
const paidCalls: unknown[][] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  session: async (req) => (req.headers.get("authorization") ? "u1" : null),
  gateway: gw,
  prepare: async () => ({ ok: true, amount_paise: 28000, existing: null }),
  store: async (...a) => { stored.push(a); return { ok: true }; },
  markPaid: async (...a) => { paidCalls.push(a); return { ok: true, order_id: O }; },
  secret: () => SECRET, ...o,
});
const post = (h: ReturnType<typeof makeHandler>, route: string, b: unknown, opts: { token?: string | null; method?: string } = {}) =>
  h(new Request(`https://x.test/payments/${route}`, { method: opts.method ?? "POST", headers: { "content-type": "application/json", ...(opts.token === null ? {} : { authorization: `Bearer ${opts.token ?? "t"}` }) }, body: (opts.method ?? "POST") === "POST" ? JSON.stringify(b) : undefined }));
const hook = async (o: Record<string, unknown> = {}) => {
  const base = { provider_order_id: "fake_order_1", provider_payment_id: "fake_pay_1" };
  const b = { ...base, ...o } as { provider_order_id: string; provider_payment_id: string; signature?: string };
  return { ...b, signature: b.signature ?? await sign(SECRET, b.provider_order_id, b.provider_payment_id) };
};
Deno.test.beforeEach?.(() => { gw = new FakeGateway(); stored.length = 0; paidCalls.length = 0; });

Deno.test("create: the gateway is asked for the amount the database says, and the payment is stored", async () => {
  gw = new FakeGateway(); stored.length = 0;
  const res = await post(makeHandler(deps()), "create", { order_id: O });
  assertEquals(res.status, 200);
  const o = await res.json();
  assertEquals([o.ok, o.provider, o.amount_paise, o.currency, o.provider_order_id.startsWith("fake_order_")], [true, "fake", 28000, "INR", true]);
  assertEquals(gw.calls.map((c) => [c.kind, c.amount_paise]), [["create", 28000]]);   // the amount never comes from the request
  assertEquals(stored.length, 1);
});

Deno.test("create: an existing open payment is returned and the gateway is not asked again", async () => {
  gw = new FakeGateway();
  const res = await post(makeHandler(deps({ prepare: async () => ({ ok: true, amount_paise: 28000, existing: "fake_order_1" }) })), "create", { order_id: O });
  assertEquals([res.status, (await res.json()).provider_order_id], [200, "fake_order_1"]);
  assertEquals(gw.calls.length, 0);
});

Deno.test("create: refusals map to 404 and 409, no login is 401, a bad body is 400, a dead gateway is 502 with no detail", async () => {
  gw = new FakeGateway();
  for (const [error, status] of [["order_not_found", 404], ["order_not_payable", 409], ["already_paid", 409]] as const) {
    const res = await post(makeHandler(deps({ prepare: async () => ({ ok: false, error, message: "m" }) })), "create", { order_id: O });
    assertEquals([error, res.status, (await res.json()).error], [error, status, error]);
  }
  assertEquals((await post(makeHandler(deps()), "create", { order_id: O }, { token: null })).status, 401);
  assertEquals((await post(makeHandler(deps()), "create", { order_id: "x" })).status, 400);
  const dead = { createOrder: () => Promise.reject(new Error("key=secret")), refund: async () => ({}) } as unknown as FakeGateway;
  const res = await post(makeHandler(deps({ gateway: dead })), "create", { order_id: O });
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "payment_unavailable" }]);
});

Deno.test("webhook: a good signature marks the order paid (the scenario)", async () => {
  paidCalls.length = 0;
  const res = await post(makeHandler(deps()), "webhook", await hook(), { token: null });
  assertEquals([res.status, await res.json()], [200, { ok: true, order_id: O }]);
  assertEquals(paidCalls, [["fake", "fake_order_1", "fake_pay_1"]]);
});

Deno.test("webhook: a bad, missing or wrong-field signature is 400 and writes nothing", async () => {
  paidCalls.length = 0;
  const h = makeHandler(deps());
  const good = await hook();
  for (const b of [{ ...good, signature: "0".repeat(64) }, { ...good, signature: "" }, { ...good, provider_payment_id: "fake_pay_OTHER" }, { ...good, provider_order_id: "fake_order_OTHER" },
    { provider_order_id: "a", provider_payment_id: "b" }, { ...good, signature: await sign("another-secret", "fake_order_1", "fake_pay_1") }]) {
    const res = await post(h, "webhook", b, { token: null });
    assertEquals([res.status, (await res.json()).error], [400, "invalid_signature"]);
  }
  assertEquals(paidCalls.length, 0);
});

Deno.test("webhook: an unknown payment is 404, a repeat is 200, no secret set is 503, and a database failure is 502", async () => {
  const b = await hook();
  assertEquals((await post(makeHandler(deps({ markPaid: async () => ({ ok: false, error: "payment_not_found", message: "m" }) })), "webhook", b, { token: null })).status, 404);
  const again = await post(makeHandler(deps({ markPaid: async () => ({ ok: true, order_id: O, already_paid: true }) })), "webhook", b, { token: null });
  assertEquals([again.status, (await again.json()).ok], [200, true]);
  assertEquals((await post(makeHandler(deps({ secret: () => "" })), "webhook", b, { token: null })).status, 503);
  const res = await post(makeHandler(deps({ markPaid: () => Promise.reject(new Error("password=secret")) })), "webhook", b, { token: null });
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "payment_unavailable" }]);
});

Deno.test("the FakeGateway records a refund and answers an id", async () => {
  const g = new FakeGateway();
  const r = await g.refund("fake_pay_1", 28000);
  assertEquals([r.refund_id.startsWith("fake_refund_"), g.calls.at(-1)], [true, { kind: "refund", provider_payment_id: "fake_pay_1", amount_paise: 28000 }]);
});

Deno.test("anything but POST is 405, an unknown route is 404", async () => {
  assertEquals((await post(makeHandler(deps()), "create", null, { method: "GET" })).headers.get("allow"), "POST");
  assertEquals((await post(makeHandler(deps()), "other", {})).status, 404);
});
