// Story #342 (E27, plan v2 B.6). Scenario: Given a place at the edge of a kitchen's radius, when serviceability is asked, then the answer names the kitchen,
// the ETA and whether it is open; outside the radius it offers 'Request here'.
import { assertEquals } from "jsr:@std/assert@1";
import { distanceM, isOpenAt, serviceability, type KitchenRow } from "./serviceability.ts";

const HK = { lat: 28.5494, lng: 77.2001 };   // Hauz Khas
const k = (o: Partial<KitchenRow> = {}): KitchenRow => ({ id: "k1", name: "Hauz Khas Kitchen", lat: HK.lat, lng: HK.lng, radius_m: 3000, prep_minutes: 20, open: true, active: true, opens_at: null, closes_at: null, ...o });
// A point due north of the kitchen, so the distance is easy to set: 1 degree of latitude is about 111,195 m.
const north = (m: number) => ({ lat: HK.lat + m / 111195, lng: HK.lng });
const noon = new Date("2026-10-27T06:30:00Z");   // 12:00 in Delhi

Deno.test("distance: zero at the same point, and about 1,000 m for 1 km north", () => {
  assertEquals(distanceM(HK, HK), 0);
  assertEquals(Math.round(distanceM(HK, north(1000)) / 10) * 10, 1000);
});

Deno.test("a place just inside the radius is served, with the kitchen's name, the ETA and open true", () => {
  const r = serviceability(north(2990), [k()], noon);
  assertEquals(r.serviceable, true);
  assertEquals(r.request_here, false);
  assertEquals([r.kitchens[0].kitchen_id, r.kitchens[0].name, r.kitchens[0].open], ["k1", "Hauz Khas Kitchen", true]);
  assertEquals(r.kitchens[0].eta_min, 20 + Math.ceil(r.kitchens[0].distance_m / 250));   // prep + a rider at 15 km/h
});

Deno.test("a place just outside the radius gets no kitchen and 'Request here'", () => {
  const r = serviceability(north(3010), [k()], noon);
  assertEquals([r.serviceable, r.request_here, r.kitchens.length], [false, true, 0]);
});

Deno.test("kitchens come nearest first; inactive kitchens and kitchens with no place are skipped", () => {
  const r = serviceability(north(500), [k({ id: "far", lat: north(2000).lat }), k({ id: "near" }), k({ id: "off", active: false }), k({ id: "nowhere", lat: null, lng: null })], noon);
  assertEquals(r.kitchens.map((x) => x.kitchen_id), ["near", "far"]);
});

Deno.test("a kitchen switched off, or outside its hours, is served but not open", () => {
  assertEquals(serviceability(north(100), [k({ open: false })], noon).kitchens[0].open, false);
  assertEquals(serviceability(north(100), [k({ opens_at: "18:00:00", closes_at: "23:00:00" })], noon).kitchens[0].open, false);
  assertEquals(serviceability(north(100), [k({ opens_at: "11:00:00", closes_at: "23:00:00" })], noon).kitchens[0].open, true);
});

Deno.test("hours: closed at the closing minute, open at the opening minute, and a night window wraps midnight", () => {
  const at = (hhmm: string) => new Date(new Date(`2026-10-27T${hhmm}:00+05:30`));
  assertEquals(isOpenAt("11:00:00", "23:00:00", at("11:00")), true);
  assertEquals(isOpenAt("11:00:00", "23:00:00", at("23:00")), false);
  assertEquals(isOpenAt("20:00:00", "02:00:00", at("23:30")), true);
  assertEquals(isOpenAt("20:00:00", "02:00:00", at("01:00")), true);
  assertEquals(isOpenAt("20:00:00", "02:00:00", at("12:00")), false);
  assertEquals(isOpenAt(null, null, at("04:00")), true);
});
