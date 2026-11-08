// Story #1052 (boards A11 the Location row, A12 the kitchen pin; before: #905 A10): the admin sets a kitchen's place on the same full-screen map the customers use.
// The form has no map: a Location row shows the set place or "Set the location"; a tap opens the shared pin map (kitchen mode, Save location).
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HERE = { latitude: 28.5677, longitude: 77.2432, accuracy: 25 };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const K1 = { id: "k-1", name: "Tau Ka Dhaba", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: null, closes_at: null, lat: null, lng: null, location_accuracy_m: null, location_at: null };

async function start(page: Page, context: Parameters<typeof setup>[0], kitchens: object[] = []) {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.geocode = { status: 200, body: GREEN_PARK };
  if (kitchens.length) net.state.kitchens = kitchens;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 500, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" }));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
  return net;
}
const city = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); };
const addForm = async (page: Page) => { await city(page); await page.getByRole("button", { name: "+ Add a kitchen" }).click(); };
const row = (page: Page) => page.getByRole("button", { name: /^Location,/ });
const screen = (page: Page) => page.getByRole("region", { name: "Pin map" });
const line = (page: Page) => page.getByTestId("location-line");
async function drag(page: Page, dx: number, dy = 0) {
  const b = (await page.locator(".ui-pinmap-map").boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2 - 100;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up();
}
const fill = async (page: Page) => {
  await page.getByLabel("Kitchen name").fill("Chhatarpur Kitchen");
  await page.getByLabel("Address").fill("Chhatarpur Main Road");
  await page.getByLabel("Phone").fill("9876500011");
  await page.getByLabel("Pin codes").fill("110016");
};

test("S1 the form has a Location row and no map; the row opens the shared map, Save location fills the row, Save kitchen writes lat and lng", async ({ page, context }) => {
  const net = await start(page, context);
  await addForm(page);
  await expect(page.locator(".ui-map-box")).toHaveCount(0);   // no inline map
  await expect(row(page)).toContainText("Set the location");
  await fill(page);
  await row(page).click();
  await expect(screen(page)).toBeVisible();
  await expect(screen(page)).toContainText("Location of Chhatarpur Kitchen");
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);
  await expect(page.getByTestId("map-pin")).toBeVisible();
  await drag(page, 80);
  await expect(page.getByRole("button", { name: "Save location" })).toBeEnabled();
  await page.getByRole("button", { name: "Save location" }).click();
  await expect(screen(page)).toHaveCount(0);
  await expect(row(page)).toContainText("Green Park");
  await expect(line(page)).toContainText(/\d+\.\d{4}, \d+\.\d{4} · set /);
  expect(net.calls.kitchenWrites).toEqual([]);   // the form is not saved by the map
  await page.getByRole("button", { name: "Save kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBeGreaterThan(0);
  const body = net.calls.kitchenWrites[0].body;
  expect(body).toMatchObject({ name: "Chhatarpur Kitchen", location_accuracy_m: null });
  expect(typeof body.lat).toBe("number");
  expect(body.lat).not.toBe(28.6139);   // the map moved under the pin before it was saved
  expect(typeof body.location_at).toBe("string");
});

test("S2 Current Location opens the map at the phone: Save location writes the phone's place", async ({ page, context }) => {
  const net = await start(page, context, [K1]);
  await city(page);
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await row(page).click();
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect(page.getByRole("button", { name: "Save location" })).toBeEnabled();
  await page.waitForTimeout(700);   // the pin rests: the words follow
  await page.getByRole("button", { name: "Save location" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].method).toBe("PATCH");
  expect(net.calls.kitchenWrites[0].url).toContain("id=eq.k-1");
  expect(Math.abs(net.calls.kitchenWrites[0].body.lat - 28.5677)).toBeLessThan(0.002);
  expect(Math.abs(net.calls.kitchenWrites[0].body.lng - 77.2432)).toBeLessThan(0.002);
});

test("S3 a kitchen with no location says Set the location; one with a location shows the place and the saved line", async ({ page, context }) => {
  await start(page, context, [K1, { ...K1, id: "k-2", name: "Rohini Kitchen", pin_codes: ["110085"], lat: 28.7, lng: 77.1, location_accuracy_m: 12, location_at: "2026-11-06T09:00:00Z" }]);
  await city(page);
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await expect(row(page)).toContainText("Set the location");
  await page.getByRole("button", { name: "Back to city" }).click();
  await page.getByRole("button", { name: /^Open kitchen Rohini Kitchen/ }).click();
  await expect(row(page)).toContainText("Green Park");
  await expect(line(page)).toContainText("28.7000, 77.1000 · set 6 Nov");
});

test("S4 Inside <pin> shows when the pin is in one of the kitchen's pin codes, and nothing when it is not", async ({ page, context }) => {
  await start(page, context, [K1, { ...K1, id: "k-2", name: "Rohini Kitchen", pin_codes: ["110085"] }]);
  await city(page);
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await row(page).click();
  await expect(page.getByRole("status")).toContainText("Inside 110016");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back to city" }).click();
  await page.getByRole("button", { name: /^Open kitchen Rohini Kitchen/ }).click();
  await row(page).click();
  await expect(page.getByRole("button", { name: "Save location" })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
});
