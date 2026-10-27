// Story #342: GET /serviceability?lat=&lng=. The data source is injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler } from "./index.ts";
import type { KitchenRow } from "./serviceability.ts";

const row: KitchenRow = { id: "k1", name: "Hauz Khas Kitchen", lat: 28.5494, lng: 77.2001, radius_m: 3000, prep_minutes: 20, open: true, active: true, opens_at: null, closes_at: null };
const h = (rows: () => Promise<KitchenRow[]> = async () => [row]) => makeHandler({ kitchens: rows, now: () => new Date("2026-10-27T06:30:00Z") });
const get = (handler: ReturnType<typeof h>, q: string, method = "GET") => handler(new Request(`https://x.test/serviceability${q}`, { method }));

Deno.test("a place in range answers 200 with the kitchen, the ETA and open", async () => {
  const res = await get(h(), "?lat=28.5494&lng=77.2001");
  assertEquals(res.status, 200);
  const a = await res.json();
  assertEquals([a.ok, a.serviceable, a.request_here, a.kitchens[0].name, a.kitchens[0].eta_min, a.kitchens[0].open], [true, true, false, "Hauz Khas Kitchen", 20, true]);
});

Deno.test("a place out of range answers 200 serviceable false and 'Request here'", async () => {
  const a = await (await get(h(), "?lat=28.7&lng=77.5")).json();
  assertEquals([a.serviceable, a.request_here, a.kitchens], [false, true, []]);
});

Deno.test("a missing, non-number or out-of-range place is 400 invalid_place", async () => {
  for (const q of ["", "?lat=28.5", "?lat=x&lng=77", "?lat=91&lng=77", "?lat=28&lng=181", "?lat=&lng=77", "?lat=NaN&lng=77"]) {
    const res = await get(h(), q);
    assertEquals([q, res.status, (await res.json()).error], [q, 400, "invalid_place"]);
  }
});

Deno.test("when the data source fails the answer is 502 serviceability_unavailable and no detail leaks", async () => {
  const res = await get(h(() => Promise.reject(new Error("password=secret"))), "?lat=28.5&lng=77.2");
  assertEquals([res.status, await res.json()], [502, { ok: false, error: "serviceability_unavailable" }]);
});

Deno.test("anything but GET is 405", async () => {
  const res = await get(h(), "?lat=28.5&lng=77.2", "POST");
  assertEquals([res.status, res.headers.get("allow")], [405, "GET"]);
});
