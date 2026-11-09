// Story #1138 (board C6e-PinMapPlate, owner approved 9 Nov): GoServe kitchens are our own, so the pin map shows each one near the view as the #937 plate, fork and spoon
// (about 28 px, green strokes on a white plate, no square frame) with a "GoServe Kitchen" tag. It is not interactive and never covers the customer's pin.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const PHONE = { latitude: 28.56, longitude: 77.2 };
const kitchen = (lat: number, lng: number, extra: object = {}) => ({ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00", radius_m: 3000, lat, lng, ...extra });

async function toMap(page: Page, context: Parameters<typeof setup>[0], kitchens: object[]) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.kitchens = kitchens;
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation(PHONE);
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await page.getByRole("button", { name: "Current Location" }).click();   // the map rests on the phone's place, so a kitchen 100 m north is in view
  return net;
}
const mark = (page: Page) => page.locator(".gs-kitchen-mark");

test("S1 a kitchen near the view shows as the plate, fork and spoon with its tag, not interactive", async ({ page, context }) => {
  await toMap(page, context, [kitchen(PHONE.latitude + 0.0009, PHONE.longitude)]);
  await expect(mark(page).locator(".gs-kitchen-in")).toBeVisible({ timeout: 8_000 });
  await expect(mark(page).locator('svg circle[r="12"]')).toHaveCount(1);   // the #937 plate: the one component, drawn with a white halo here
  await expect(mark(page).locator('svg path[d^="M8 10v9"]').last()).toBeAttached();   // and its fork
  await expect(mark(page)).toContainText("GoServe Kitchen");
  expect(await mark(page).evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");   // not a button, nothing to tap
  expect((await mark(page).locator("svg").boundingBox())!.width).toBeGreaterThanOrEqual(24);
  expect((await mark(page).locator("svg").boundingBox())!.width).toBeLessThanOrEqual(32);
});

test("S2 it never covers the customer's pin: a kitchen at the pin leaves no mark under it", async ({ page, context }) => {
  await toMap(page, context, [kitchen(PHONE.latitude, PHONE.longitude)]);
  await expect(page.getByText(/We deliver here/)).toBeVisible();
  await expect(mark(page).locator("svg")).toHaveCount(0);   // hidden while it would sit under the pin
});

test("S3 a kitchen close to the pin is drawn clear of it: its art never touches the pin", async ({ page, context }) => {
  await toMap(page, context, [kitchen(PHONE.latitude + 0.00063, PHONE.longitude)]);   // about 70 m: close
  await expect(mark(page).locator("svg")).toBeVisible({ timeout: 8_000 });
  const pin = (await page.getByTestId("map-pin").boundingBox())!, art = (await mark(page).locator("svg").boundingBox())!;
  const apart = art.y + art.height <= pin.y || art.y >= pin.y + pin.height || art.x + art.width <= pin.x || art.x >= pin.x + pin.width;
  expect(apart).toBe(true);
});

test("S4 a kitchen with no place, or a demo one, is not drawn; the kitchen admin's own pin screen has no marks", async ({ page, context }) => {
  await toMap(page, context, [kitchen(null as unknown as number, null as unknown as number), kitchen(PHONE.latitude + 0.0009, PHONE.longitude, { id: "k-2", synthetic: true })]);
  await expect(page.getByText(/We deliver here/)).toBeVisible();
  await expect(mark(page)).toHaveCount(0);
});
