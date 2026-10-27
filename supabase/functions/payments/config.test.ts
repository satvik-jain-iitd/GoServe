// Story #569: the gateway JWT check is off for `payments` and `push`, so the real Razorpay webhook (no login) and the database's notify call (our secret) can reach them.
// That is safe only because the functions check the caller themselves. This test pins both halves: the config, and the 401 of every route that is not the webhook.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";
import { FakeGateway } from "../_shared/gateway.ts";

const config = await Deno.readTextFile(new URL("../../config.toml", import.meta.url));
const section = (name: string) => config.split(/^\[/m).find((s) => s.startsWith(`functions.${name}]`)) ?? "";

Deno.test("config: payments and push run without the gateway JWT check", () => {
  for (const name of ["payments", "push"]) assert(/verify_jwt\s*=\s*false/.test(section(name)), `${name} must have verify_jwt = false`);
});

Deno.test("config: the switch is explained where it is set", () => {
  assert(/webhook[^\[]*\[functions\.payments\]/i.test(config), "the comment above [functions.payments] must say the webhook has no login");
});

const O = "7e57ab1e-0000-4000-8000-0000000000f1";
const deps = (): Deps => ({
  session: async (req) => (req.headers.get("authorization") ? "u1" : null),
  gateway: new FakeGateway(),
  prepare: async () => ({ ok: true, amount_paise: 100, existing: null }),
  store: async () => ({ ok: true }),
  markPaid: async () => ({ ok: true, order_id: O }),
  switchCash: async () => ({ ok: true }),
  secret: () => "s",
});

Deno.test("with the gateway check off, create and switch-to-cash with no token are 401 and reach nothing", async () => {
  const touched: string[] = [];
  const d: Deps = { ...deps(), prepare: async () => { touched.push("prepare"); return { ok: true, amount_paise: 1, existing: null }; }, switchCash: async () => { touched.push("switchCash"); return { ok: true }; } };
  for (const route of ["create", "switch-to-cash"]) {
    const res = await makeHandler(d)(new Request(`https://x.test/payments/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: O }) }));
    assertEquals([route, res.status, (await res.json()).error], [route, 401, "unauthorized"]);
  }
  assertEquals(touched, []);
});

Deno.test("with the gateway check off, the webhook with no signature is 400 and marks nothing paid", async () => {
  let paid = 0;
  const res = await makeHandler({ ...deps(), markPaid: async () => { paid++; return { ok: true, order_id: O }; } })(
    new Request("https://x.test/payments/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider_order_id: "o", provider_payment_id: "p" }) }));
  assertEquals([res.status, paid], [400, 0]);
});
