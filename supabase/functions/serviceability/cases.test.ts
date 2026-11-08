// Story #1102: the shared cases of the one serviceability rule (spec/serviceability_cases.json), the same file the app and the database run.
// The function always gets a place, so the cases with no place (a pin alone) are the app's and the database's.
import { assertEquals } from "jsr:@std/assert@1";
import { serviceability, type KitchenRow } from "./serviceability.ts";

const file = JSON.parse(await Deno.readTextFile(new URL("../../../spec/serviceability_cases.json", import.meta.url)));
const noon = new Date("2026-10-27T06:30:00Z");
for (const c of file.cases.filter((x: { place: unknown }) => x.place)) {
  Deno.test(`shared case: ${c.name}`, () => {
    const row: KitchenRow = { id: "k", name: "K", prep_minutes: 20, open: true, opens_at: null, closes_at: null, ...c.kitchen };
    assertEquals(serviceability(c.place, [row], noon, c.pin).serviceable, c.served);
  });
}
