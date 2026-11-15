// Story 1548 (owner, 15 Nov 2026): the far strip of story 1056 (board SW2), "You are n km from Home · Deliver here", is gone from the menu. Its job is done by the box
// "Where should we deliver?" and by the Bill's line. With it goes its push: the menu's parts are in the same place for a phone far from Home and a phone at Home.
import { test, expect, type Page } from "@playwright/test";
import { setup, whereBox } from "./helpers";

const NOW = Date.now();
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(NOW - 3 * 86_400_000).toISOString() };
const FAR_PHONE = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home
const NEAR_PHONE = { latitude: 28.5690, longitude: 77.2440 };   // about 150 m
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const strip = (page: Page) => page.getByRole("status").filter({ hasText: /You are \d+ km from/ });

async function open(page: Page, context: Parameters<typeof setup>[0], phone: { latitude: number; longitude: number } | null) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.nearPin = "110099";   // no kitchen serves the place the phone is at
  await context.addInitScript((h) => {   // Home is the place on this phone, with a cart in progress
    if (window.localStorage.getItem("gs-place")) return;
    window.localStorage.setItem("gs-place", JSON.stringify({ address: h.address, pin: h.pin_code, lat: h.lat, lng: h.lng, house: "", landmark: "", confirmed: true, id: h.id })); window.localStorage.setItem("gs-pin", h.pin_code);
    window.localStorage.setItem("gs-draft", JSON.stringify({ step: "menu", cart: { d1: 1 }, address: h.address, name: "", phone: "" }));
  }, HOME);
  net.state.geocode = { status: 200, body: GREEN_PARK };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  if (phone) { await context.grantPermissions(["geolocation"]); await context.setGeolocation(phone); }
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();
  return net;
}

// The menu's parts, by measure in the browser.
const parts = (page: Page) => page.evaluate(() => [".ui-top", ".ui-search-box", ".ui-scroll", ".ui-greet", ".ui-section", ".ui-tile-body"].map((sel) => {
  const el = document.querySelector(sel);
  if (!el) return `${sel} is not on the screen`;
  const r = el.getBoundingClientRect();
  return `${sel} ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}`;
}));

test("S1 more than 2 km from Home, with a cart in progress: no strip shows behind the box or after I answer with Home, and nothing on the menu is pushed down", async ({ page, context, browser }) => {
  const net = await open(page, context, FAR_PHONE);
  await expect(whereBox(page)).toBeVisible();
  await expect(strip(page)).toHaveCount(0);   // not behind the box
  await expect(page.getByRole("button", { name: "Deliver here" })).toHaveCount(0);
  await whereBox(page).getByRole("button", { name: "Use another address" }).click();   // Home is my answer
  await page.getByRole("button", { name: "Deliver to Home" }).click();
  await expect(page.getByRole("button", { name: /^Home\b/ })).toBeVisible();   // the header keeps Home
  await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();   // the cart is still there
  await page.waitForTimeout(300);
  await expect(strip(page)).toHaveCount(0);   // and not on the menu
  await expect(page.getByRole("button", { name: "Deliver here" })).toHaveCount(0);
  expect(net.calls.geocode).toHaveLength(0);   // no map or geocode call
  const far = await parts(page);
  const near = await browser.newContext({ viewport: page.viewportSize()! });   // the same menu for a phone at Home
  const page2 = await near.newPage();
  await open(page2, near, NEAR_PHONE);
  await expect(page2.getByRole("button", { name: /View bill/ })).toBeVisible();
  expect(far).toEqual(await parts(page2));   // rule 23: the strip's 51 px push is gone
  expect(far.join(" ")).not.toContain("is not on the screen");
  await near.close();
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
