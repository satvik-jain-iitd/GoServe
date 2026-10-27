// Story #343: GET /menu?kitchen=<uuid>. The data source is injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler } from "./index.ts";
import type { DishRow } from "./menu.ts";

const KITCHEN = "7e57ab1e-0000-4000-8000-000000000001";
const rows: DishRow[] = [{ id: "d1", name: "Dal Makhani thali", price_paise: 14000, available: true, veg: true, category: "Thali", sort: 1, image_url: null, badge: "bestseller", size_tag: "regular", protein_g: 18, back_soon_at: null, created_at: "2026-09-01T00:00:00Z" }];
const ok = makeHandler({ rows: async (k) => (k === KITCHEN ? rows : []), now: () => new Date("2026-10-27T10:00:00Z") });
const get = (qs: string) => ok(new Request("https://x.test/menu" + qs));

Deno.test("a kitchen id gets 200 with categories and collections", async () => {
  const res = await get("?kitchen=" + KITCHEN);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/json");
  const b = await res.json();
  assertEquals(b.kitchen_id, KITCHEN);
  assertEquals(b.categories[0].dishes[0].id, "d1");
  assertEquals(b.collections[0].key, "bestsellers");
});

Deno.test("a kitchen with no dishes gets 200 and empty lists, not an error", async () => {
  const b = await (await get("?kitchen=7e57ab1e-0000-4000-8000-000000000002")).json();
  assertEquals([b.categories, b.collections], [[], []]);
});

Deno.test("a missing or malformed kitchen id gets 400 invalid_kitchen", async () => {
  for (const qs of ["", "?kitchen=", "?kitchen=abc", "?kitchen=" + KITCHEN + "x"]) {
    const res = await get(qs);
    assertEquals(res.status, 400, qs);
    assertEquals((await res.json()).error, "invalid_kitchen");
  }
});

Deno.test("when the data source fails the answer is 502 menu_unavailable and no detail leaks", async () => {
  const bad = makeHandler({ rows: () => Promise.reject(new Error("password=secret host=db.internal")), now: () => new Date() });
  const res = await bad(new Request("https://x.test/menu?kitchen=" + KITCHEN));
  assertEquals(res.status, 502);
  const text = await res.text();
  assertEquals(JSON.parse(text), { ok: false, error: "menu_unavailable" });
});

Deno.test("anything but GET or HEAD is 405", async () => {
  const res = await ok(new Request("https://x.test/menu?kitchen=" + KITCHEN, { method: "POST" }));
  assertEquals([res.status, res.headers.get("allow")], [405, "GET, HEAD"]);
});
