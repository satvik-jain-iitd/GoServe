// Story #1056 (board SW2): the header keeps the chosen address; when the phone (location already allowed) is more than 2 km from it, a strip says how far and offers "Deliver here".
// Within 2 km, or with location not allowed, nothing shows and nothing is asked. The check uses the phone's place and the saved lat and lng only.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const NOW = Date.now();
const HOME = { id: "h1", label: "Home", address: "C-128, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(NOW - 3 * 86_400_000).toISOString() };
const FAR_PHONE = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home
const NEAR_PHONE = { latitude: 28.5690, longitude: 77.2440 };   // about 150 m
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const strip = (page: Page) => page.getByRole("status").filter({ hasText: /You are \d+ km from/ });

async function open(page: Page, context: Parameters<typeof setup>[0], phone: { latitude: number; longitude: number } | null) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: GREEN_PARK };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  if (phone) { await context.grantPermissions(["geolocation"]); await context.setGeolocation(phone); }
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /^Home\b/ })).toBeVisible();
  return net;
}

test("S1 more than 2 km from Home: the strip says how far; Deliver here opens the pin map at the phone, then the details sheet", async ({ page, context }) => {
  const net = await open(page, context, FAR_PHONE);
  await expect(strip(page)).toContainText("You are 6 km from Home");
  await expect(page.getByRole("button", { name: /^Home\b/ })).toBeVisible();   // the header keeps Home
  expect(net.calls.geocode).toHaveLength(0);   // the check made no map or geocode call
  await strip(page).getByRole("button", { name: "Deliver here" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
});

test("S2 within 2 km of Home: no strip", async ({ page, context }) => {
  await open(page, context, NEAR_PHONE);
  await page.waitForTimeout(500);
  await expect(strip(page)).toHaveCount(0);
});

test("S3 location not allowed: no strip, and the phone is never asked", async ({ page, context }) => {
  await context.addInitScript(() => { (window as unknown as { __asked: number }).__asked = 0; const g = navigator.geolocation; const orig = g.getCurrentPosition.bind(g); g.getCurrentPosition = (...a: Parameters<typeof orig>) => { (window as unknown as { __asked: number }).__asked++; return orig(...a); }; });
  await open(page, context, null);
  await page.waitForTimeout(500);
  await expect(strip(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0);
});
