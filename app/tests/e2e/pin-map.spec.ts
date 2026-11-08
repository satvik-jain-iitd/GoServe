// Story #1037 (board C6-PinMap): one full-screen map screen is the door for Add new address, Use current location and a tapped search result.
// A plain DOM pin sits at the centre, the map moves under it, 400 ms after it stops the words and the served strip follow. No zoom control, no tooltip, no inline map.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const OSM_CORS = { "access-control-allow-origin": "*", "content-type": "application/json" };
const NOW = Date.now();
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(NOW - 3 * 86_400_000).toISOString() };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const PHONE = { latitude: 28.56, longitude: 77.2 };

async function open(page: Page, context: Parameters<typeof setup>[0], over: { geocode?: { status: number; body: object } | null; serve?: { status: number; body: object } | null; permission?: boolean; places?: object } = {}) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.geocode = over.geocode === undefined ? { status: 200, body: GREEN_PARK } : over.geocode;
  if (over.serve) net.state.serve = over.serve;
  if (over.places) net.state.places = over.places as { status: number; body: object };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 500, headers: OSM_CORS, body: "{}" }));
  if (over.permission !== false) { await context.grantPermissions(["geolocation"]); await context.setGeolocation(PHONE); }
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  return net;
}
const screen = (page: Page) => page.getByRole("region", { name: "Pin map" });
const mapBox = (page: Page) => page.locator(".ui-pinmap-map");
async function drag(page: Page, dx: number, dy = 0) {
  const b = (await mapBox(page).boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2 - 100;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up();
}

test("S1 Add new address opens the full-screen map: back, search, a DOM pin at the centre, Current Location, the card, no zoom control, no tooltip", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search an area or address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Current Location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
  const pin = page.getByTestId("map-pin");
  await expect(pin).toBeVisible();
  expect(await pin.evaluate((el) => el.closest(".leaflet-marker-icon, .leaflet-pane") === null)).toBe(true);   // a plain element over the map, not a Leaflet marker
  await expect(page.locator(".leaflet-control-zoom")).toHaveCount(0);
  await expect(page.getByText(/Move the pin/i)).toHaveCount(0);
  const full = await screen(page).boundingBox();
  const vp = page.viewportSize()!;
  expect([Math.round(full!.width), Math.round(full!.height)]).toEqual([vp.width, vp.height]);   // full screen, never inline
});

test("S2 the pin colour is the primary green, and the pin sits at the centre of the map box", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  const pin = page.getByTestId("map-pin");
  await expect(pin).toBeVisible();
  const color = await pin.evaluate((el) => getComputedStyle(el).color);
  const primary = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--md-primary)"; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  expect(color).toBe(primary);
  const m = (await mapBox(page).boundingBox())!, p = (await pin.boundingBox())!;
  expect(Math.abs(p.x + p.width / 2 - (m.x + m.width / 2))).toBeLessThanOrEqual(2);   // centred across
  expect(Math.abs(p.y + p.height * 0.625 - (m.y + m.height / 2))).toBeLessThanOrEqual(2);   // its tip (62.5 percent down the marker with its halo, board C6) is the centre of the map
});

test("S3 the card gives the place name, the address line, the lime served strip and the credit line", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page).getByText("Green Park", { exact: true })).toBeVisible();
  await expect(screen(page).getByText("New Delhi, Delhi")).toBeVisible();
  await expect(screen(page).getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible();
  await expect(screen(page).getByText(/Ola Maps/)).toBeVisible();
  await expect(screen(page).getByText(/© OpenStreetMap contributors/)).toBeVisible();
  expect(net.calls.geocode).toHaveLength(1);
  expect(net.calls.serve).toHaveLength(1);
});

test("S4 dragging the map asks once, 400 ms after it stops, with the new centre", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page).getByText("Green Park", { exact: true })).toBeVisible();
  const before = net.calls.geocode.length;
  await drag(page, 120);   // one drag: one answer for the place it rests on
  await expect.poll(() => net.calls.geocode.length, { timeout: 5000 }).toBe(before + 1);
  await page.waitForTimeout(900);
  expect(net.calls.geocode.length).toBe(before + 1);
  expect(net.calls.serve.length).toBe(before + 1);
  const last = new URL(net.calls.geocode.at(-1)!);
  expect(Number(last.searchParams.get("lng"))).not.toBeCloseTo(77.2, 3);   // it moved
});

test("S5 a pin no kitchen reaches gets the red strip", async ({ page, context }) => {
  await open(page, context, { serve: { status: 200, body: { ok: true, serviceable: false, request_here: true, kitchens: [] } } });
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page).getByText("Not in our area yet")).toBeVisible();
  await expect(screen(page).getByText(/We deliver here/)).toHaveCount(0);
});

test("S6 a lookup that fails keeps the pin and says so in words; Confirm still works", async ({ page, context }) => {
  await open(page, context, { geocode: { status: 503, body: { ok: false } } });
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page).getByText("Could not read the address, the pin still counts")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
});

test("S7 Current Location moves the map to the phone, and the brown dot shows with permission", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.locator(".gs-here-dot")).toBeVisible();
  await context.setGeolocation({ latitude: 28.61, longitude: 77.23 });
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect.poll(() => net.calls.serve.at(-1) ?? "").toContain("lat=28.61");
});

test("S8 no permission: no dot, and the map never asks for it by itself", async ({ page, context }) => {
  await open(page, context, { permission: false });
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page)).toBeVisible();
  await expect(page.locator(".gs-here-dot")).toHaveCount(0);
});

test("S9 Use current location opens the map at the phone; a tapped search result opens it at the place; back returns to Deliver to", async ({ page, context }) => {
  const net = await open(page, context, { places: { status: 200, body: { ok: true, results: [{ name: "Chhatarpur", address: "Chhatarpur, Madhya Pradesh, 471001", lat: 24.9, lng: 79.58, pin: "471001", served: false }] } } });
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(screen(page)).toBeVisible();
  await expect.poll(() => net.calls.geocode.at(-1) ?? "").toContain("lat=28.56");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
  const box = page.getByRole("searchbox", { name: "Search an area or address" });
  await box.fill("chhat"); await box.press("Enter");
  await page.getByRole("region", { name: "Places" }).getByRole("button").first().click();
  await expect(screen(page)).toBeVisible();
  await expect.poll(() => net.calls.geocode.at(-1) ?? "").toContain("lat=24.9");
});

test("S10 Confirm & proceed opens the details step over the same map (story #1038), and saving stores the pin's place", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(screen(page).getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  const sheet = page.getByRole("dialog", { name: "Address details" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("House, flat, floor").fill("12B");
  await sheet.getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(2);
  const saved = net.state.addresses.at(-1)!;
  expect(saved).toMatchObject({ label: "Home", address: "12B, Green Park, New Delhi, Delhi", pin_code: "110016" });
  expect(saved.lat).toBeCloseTo(28.56, 3);
});
