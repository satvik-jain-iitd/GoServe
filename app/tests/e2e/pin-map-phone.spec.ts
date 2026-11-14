// Story #1502 (no new board; the pin, the dot and the card stay as on board C6): the pin map opens where the phone is when location is allowed,
// even when the phone answers late. It is never pulled back after the person moved it. With no location and no saved address it opens at the kitchen,
// not at the fixed Delhi point. The screen never asks for location by itself. All points here are public test points.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(Date.now() - 3 * 86_400_000).toISOString() };
const PHONE = { lat: 28.56, lng: 77.2 };
const KITCHEN = { lat: 28.5494, lng: 77.2001 };
const DELHI = { lat: 28.6139, lng: 77.209 };
type Ctx = Parameters<typeof setup>[0];

// The phone's place comes late: the one-time read never answers, the watch answers after `lateMs` and then every 400 ms. Every ask is counted.
const latePhone = (context: Ctx, lateMs: number) => context.addInitScript(([at, ms]) => {
  const w = window as unknown as { __asks: number };
  w.__asks = 0;
  const pos = { coords: { latitude: (at as { lat: number }).lat, longitude: (at as { lng: number }).lng, accuracy: 20 }, timestamp: Date.now() };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: () => { w.__asks++; },
    watchPosition: (ok: (p: unknown) => void) => { w.__asks++; setTimeout(() => { ok(pos); setInterval(() => ok(pos), 400); }, ms as number); return 1; },   // like a real phone: the place keeps coming
    clearWatch: () => undefined,
  } });
}, [PHONE, lateMs] as const);

async function start(page: Page, context: Ctx, over: { addresses?: object[]; kitchenAt?: { lat: number; lng: number } | null } = {}) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = over.addresses ?? [HOME];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  if (over.kitchenAt !== undefined) net.state.kitchens = (net.state.kitchens as object[]).map((k) => ({ ...k, lat: over.kitchenAt?.lat ?? null, lng: over.kitchenAt?.lng ?? null }));
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 500, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" }));
  return net;
}
const addNew = async (page: Page) => {
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
};
// Where the pin rests: the place of the last address lookup.
// Story 1500: a rest asks only our own serviceability answer, so the place under the pin is read from that call.
const pinAt = (net: { calls: { serve: string[] } }) => { const u = new URL(net.calls.serve.at(-1) ?? "https://x/?lat=0&lng=0"); return { lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) }; };
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos(a.lat * Math.PI / 180));
async function drag(page: Page, dx: number) {
  const b = (await page.locator(".ui-pinmap-map").boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2 - 100;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y, { steps: 6 }); await page.mouse.up();
}

test("M1 The map opens where the phone is when location is allowed and the place came late", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await latePhone(context, 1200);
  const net = await start(page, context);
  await addNew(page);
  await expect.poll(() => metres(pinAt(net), PHONE), { timeout: 8000 }).toBeLessThan(50);
  await expect(page.locator(".gs-here-dot")).toHaveCount(1);
});

test("M2 The map is not pulled back after the customer moved it", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await latePhone(context, 2500);
  const net = await start(page, context);
  await addNew(page);
  await drag(page, 120);
  await expect(page.locator(".gs-here-dot")).toHaveCount(1, { timeout: 8000 });   // the phone's place arrived: the dot shows it
  await page.waitForTimeout(1200);
  expect(metres(pinAt(net), PHONE)).toBeGreaterThan(1000);   // the pin stays near Home, where the customer left it
  expect(metres(pinAt(net), HOME)).toBeLessThan(400);
});

test("M2b Confirm before the phone's place comes, then Change: the pin stays where it was confirmed", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await latePhone(context, 3000);
  const net = await start(page, context);
  await addNew(page);
  await page.getByRole("button", { name: "Confirm & proceed" }).click();   // confirmed near Home, before the phone answered
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
  await expect(page.locator(".gs-here-dot")).toHaveCount(1, { timeout: 8000 });   // the phone's place arrived while the sheet was open
  await page.getByRole("button", { name: "Change" }).click();
  await page.waitForTimeout(1200);
  expect(metres(pinAt(net), HOME)).toBeLessThan(400);
  expect(metres(pinAt(net), PHONE)).toBeGreaterThan(1000);
});

test("M3 With no location and no saved address the map opens at the kitchen", async ({ page, context }) => {
  const net = await start(page, context, { addresses: [], kitchenAt: KITCHEN });
  await addNew(page);
  await expect.poll(() => metres(pinAt(net), KITCHEN), { timeout: 8000 }).toBeLessThan(50);
  expect(metres(pinAt(net), DELHI)).toBeGreaterThan(1000);
});

test("M3b no kitchen has a place: the old fixed point stays as the last step", async ({ page, context }) => {
  const net = await start(page, context, { addresses: [], kitchenAt: null });
  await addNew(page);
  await expect.poll(() => metres(pinAt(net), DELHI), { timeout: 8000 }).toBeLessThan(50);
});

test("M4 The map screen does not ask for location by itself", async ({ page, context }) => {
  await latePhone(context, 100);   // the phone was never asked: the permission is still a question
  await start(page, context);
  await addNew(page);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __asks: number }).__asks)).toBe(0);
});

test("M5 the kitchen admin's pin screen, for a kitchen with no place yet, moves to the phone", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await latePhone(context, 800);
  const net = await start(page, context);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "+ Add a kitchen" }).click();
  await page.locator(".ui-locrow").click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.locator(".gs-here-dot")).toHaveCount(1, { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Save location" }).click();   // story 1500: the kitchen screen reads the place once, on Save location
  await expect.poll(() => { const u = new URL(net.calls.geocode.at(-1) ?? "https://x/?lat=0&lng=0"); return metres({ lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) }, PHONE); }, { timeout: 8000 }).toBeLessThan(50);
});
