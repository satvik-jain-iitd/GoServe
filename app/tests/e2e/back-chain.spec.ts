// Story 1415, review of PR #1423: a sheet that closes and opens the next thing in one tap keeps every Back step,
// and a reload keeps the step the screen already had (no dead Back press).
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-128, near the park gate, Green Park, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const onMenu = (page: Page) => expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
const deliverTo = (page: Page) => page.getByRole("heading", { name: "Deliver to", exact: true });
const leftApp = async (page: Page) => { await page.goBack(); await expect(page).not.toHaveURL(/\/customer\//); };

test("S12 address menu Edit, then the map: Back closes the map, Back shows the menu, the next Back leaves the app", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME, WORK];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Work|Home|Deliver to)\b/ }).first().click();
  await expect(deliverTo(page)).toBeVisible();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Pin map" })).toHaveCount(0);
  await expect(deliverTo(page)).toBeVisible();
  await page.goBack();
  await onMenu(page);
  await leftApp(page);
});

test("S13 location-off sheet View all opens Deliver to: Back shows the menu, the next Back leaves the app", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME, WORK];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", { value: { query: async () => ({ state: "denied" }) }, configurable: true });
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: () => {} }, configurable: true });
  });
  await page.goto("/customer/");
  const sheet = page.getByRole("dialog", { name: "Location is off" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "View all" }).click();
  await expect(deliverTo(page)).toBeVisible();
  await page.goBack();
  await onMenu(page);
  await leftApp(page);
});

test("S14 a reload on the bill: one Back shows the menu", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await onMenu(page);
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeVisible();
  await page.goBack();
  await onMenu(page);
});
