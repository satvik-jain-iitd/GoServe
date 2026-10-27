// Story #346: GET /coupons, the list of the coupons valid now. The data source is injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, type Deps } from "./index.ts";

const flat = { code: "FLAT50", title: "Rs 50 off", kind: "flat" as const, amount_paise: 5000, percent: 0, cap_paise: 0, min_order_paise: 20000, first_order_only: false };
const deps = (o: Partial<Deps> = {}): Deps => ({ list: async () => [flat], ...o });
const get = (h: ReturnType<typeof makeHandler>, method = "GET") => h(new Request("https://x.test/coupons", { method }));

Deno.test("GET /coupons answers the valid coupons with what a screen shows", async () => {
  const res = await get(makeHandler(deps()));
  assertEquals([res.status, await res.json()], [200, { ok: true, coupons: [flat] }]);
});

Deno.test("no coupon valid: 200 and an empty list", async () => {
  assertEquals(await (await get(makeHandler(deps({ list: async () => [] })))).json(), { ok: true, coupons: [] });
});

Deno.test("a dead database is 502 with no detail", async () => {
  const res = await get(makeHandler(deps({ list: () => Promise.reject(new Error("host=10.0.0.1")) })));
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "coupons_unavailable" }]);
});

Deno.test("anything but GET is 405", async () => {
  const res = await get(makeHandler(deps()), "POST");
  assertEquals([res.status, res.headers.get("allow")], [405, "GET"]);
});
