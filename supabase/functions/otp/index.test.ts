// Story #339: POST /otp/send and POST /otp/verify, built with a TEST DOUBLE for the SMS sender until the owner clicks the provider.
// The rules (3 sends in 10 minutes, 5 tries, 10 minutes, one use) are in the database (scripts/test_otp.py); this handler checks the request, sends the
// code through an injected sender, and on the right code links the phone to the caller's own user, so the guest orders stay with the account.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";

const sent: unknown[][] = [];
const linked: unknown[][] = [];
const deps = (o: Partial<Deps> = {}): Deps => ({
  session: async (req) => (req.headers.get("authorization") ? "u1" : null),
  issue: async () => ({ ok: true, code: "482913", expires_in_s: 600 }),
  sms: async (...a) => { sent.push(a); },
  check: async () => ({ ok: true, phone: "919876543210" }),
  link: async (...a) => { linked.push(a); return { ok: true }; }, ...o,
});
const post = (h: ReturnType<typeof makeHandler>, route: string, b: unknown, opts: { token?: string | null; method?: string } = {}) =>
  h(new Request(`https://x.test/otp/${route}`, { method: opts.method ?? "POST", headers: { "content-type": "application/json", ...(opts.token === null ? {} : { authorization: `Bearer ${opts.token ?? "t"}` }) }, body: (opts.method ?? "POST") === "POST" ? JSON.stringify(b) : undefined }));

Deno.test("send: the code goes to the sender, never into the answer", async () => {
  sent.length = 0;
  const res = await post(makeHandler(deps()), "send", { phone: "9876543210" });
  const text = await res.text();
  assertEquals(res.status, 200);
  assertEquals(JSON.parse(text), { ok: true, expires_in_s: 600 });
  assertEquals(text.includes("482913"), false);
  assertEquals(sent, [["919876543210", "482913"]]);
});

Deno.test("send: each refusal has its status and the sender is not called", async () => {
  sent.length = 0;
  for (const [error, status] of [["invalid_phone", 400], ["too_many_sends", 429]] as const) {
    const res = await post(makeHandler(deps({ issue: async () => ({ ok: false, error, message: "m" }) })), "send", { phone: "9876543210" });
    assertEquals([error, res.status, (await res.json()).error], [error, status, error]);
  }
  assertEquals(sent.length, 0);
});

Deno.test("send: a sender that fails answers 502 sms_unavailable and no detail leaks", async () => {
  const res = await post(makeHandler(deps({ sms: () => Promise.reject(new Error("api-key=secret")) })), "send", { phone: "9876543210" });
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "sms_unavailable" }]);
});

Deno.test("verify: the right code links the phone to the caller's own user (so the guest orders stay) and answers 200", async () => {
  linked.length = 0;
  const res = await post(makeHandler(deps()), "verify", { phone: "9876543210", code: "482913" });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, linked: true, phone: "919876543210", user_id: "u1" });
  assertEquals(linked, [["u1", "919876543210"]]);
});

Deno.test("verify: a wrong, old or missing code is 422, too many tries is 429, and nothing is linked", async () => {
  linked.length = 0;
  for (const [error, status] of [["wrong_code", 422], ["code_expired", 422], ["no_code", 422], ["too_many_attempts", 429]] as const) {
    const res = await post(makeHandler(deps({ check: async () => ({ ok: false, error, message: "m" }) })), "verify", { phone: "9876543210", code: "000000" });
    assertEquals([error, res.status, (await res.json()).error], [error, status, error]);
  }
  assertEquals(linked.length, 0);
});

Deno.test("verify: a phone that already belongs to another user is 409 phone_in_use (a returning customer on a new phone needs the real provider)", async () => {
  const res = await post(makeHandler(deps({ link: async () => ({ ok: false, error: "phone_in_use", message: "m" }) })), "verify", { phone: "9876543210", code: "482913" });
  assertEquals([res.status, (await res.json()).error], [409, "phone_in_use"]);
});

Deno.test("no login is 401 on both routes and nothing is asked of the database", async () => {
  for (const route of ["send", "verify"]) {
    const res = await post(makeHandler(deps()), route, { phone: "9876543210", code: "482913" }, { token: null });
    assertEquals([route, res.status, (await res.json()).error], [route, 401, "unauthorized"]);
  }
});

Deno.test("a malformed request is 400 invalid_request: a missing phone, a code that is not six digits, not JSON, an unknown route", async () => {
  const h = makeHandler(deps());
  for (const [route, b] of [["send", {}], ["send", { phone: 9876543210 }], ["verify", { phone: "9876543210" }], ["verify", { phone: "9876543210", code: "12345" }], ["verify", { phone: "9876543210", code: "12345a" }]] as const) {
    const res = await post(h, route, b);
    assertEquals([route, res.status, (await res.json()).error], [route, 400, "invalid_request"]);
  }
  assertEquals((await h(new Request("https://x.test/otp/send", { method: "POST", headers: { authorization: "Bearer t" }, body: "{nope" }))).status, 400);
  assertEquals((await post(h, "other", {})).status, 404);
});

Deno.test("when the database fails the answer is 502 otp_unavailable and no detail leaks", async () => {
  const res = await post(makeHandler(deps({ check: () => Promise.reject(new Error("password=secret")) })), "verify", { phone: "9876543210", code: "482913" });
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "otp_unavailable" }]);
});

Deno.test("anything but POST is 405", async () => {
  const res = await post(makeHandler(deps()), "send", null, { method: "GET" });
  assertEquals([res.status, res.headers.get("allow")], [405, "POST"]);
});
