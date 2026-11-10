// Regression, screen 30: SW2 Far from Home and SW3 Location off. Cases: .claude/handoff/qa/screens/30-SW.md (epic #1196). Reached with the shared steps STEPS["menu-far"] and STEPS["location-off"].
// TC 30.5 (Turn on location: the phone asks, then the menu or the far strip) is owner only: a real phone's location prompt cannot be answered here.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

test.use({ viewport: { width: 390, height: 844 } });

const strip = (page: Page) => page.getByRole("status").filter({ hasText: /You are \d+ km from/ });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Location is off" });
const header = (page: Page) => page.getByRole("button", { name: /^Home\b/ });

test("TC 30.1 Look: the app 6 km from Home keeps Home in the header, the lime strip says so with Deliver here", async ({ page, context }) => {
  await STEPS["menu-far"](context, page, "/customer/");
  await expect(strip(page)).toBeVisible();   // proves the strip shows before its words are checked
  await expect(strip(page)).toContainText("You are 6 km from Home");
  await expect(strip(page).getByRole("button", { name: "Deliver here" })).toBeVisible();
  await expect(header(page)).toBeVisible();
  await expect(header(page)).toContainText("Green Avenue Colony");   // Home stays in the header, with its address
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the menu is there behind the strip
  const bg = await strip(page).evaluate((e) => getComputedStyle(e).backgroundColor);
  const [r, g, b] = (bg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  expect(g, `strip colour ${bg}`).toBeGreaterThan(r);   // lime: green is the strongest of the three
  expect(g, `strip colour ${bg}`).toBeGreaterThan(b);
});

test("TC 30.2 Tap Deliver here: the pin map opens centred on my spot", async ({ page, context }) => {
  const looked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/functions/v1/geocode")) looked.push(r.url()); });   // the map asks for the words at its centre once it settles
  await STEPS["menu-far"](context, page, "/customer/");
  await expect(strip(page)).toBeVisible();   // proves the strip shows before the tap
  await strip(page).getByRole("button", { name: "Deliver here" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
  // The phone is at 28.6139, 77.209: the map's centre words must come from there, not from Home (28.5677, 77.2432).
  await expect.poll(() => looked.length).toBeGreaterThan(0);
  const at = new URL(looked.at(-1)!).searchParams;
  expect(Math.abs(Number(at.get("lat")) - 28.6139)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(Number(at.get("lng")) - 77.209)).toBeLessThanOrEqual(0.01);
});

test("TC 30.3 Look: location off shows the sheet with Turn on location, Your addresses with View all, and Search your area", async ({ page, context }) => {
  await STEPS["location-off"](context, page, "/customer/");
  await expect(sheet(page)).toBeVisible();   // proves the sheet shows before its parts are checked
  await expect(sheet(page).getByRole("heading", { name: "Location is off" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Turn on location" })).toBeVisible();
  await expect(sheet(page).getByText("Your addresses", { exact: true })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "View all" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Search your area" })).toBeVisible();
});

test("TC 30.4 Tap a saved address in the sheet: the sheet closes and the menu is for that address", async ({ page, context }) => {
  await STEPS["location-off"](context, page, "/customer/");
  // Home and Office are both saved. Home is in the header before the tap, so the tap must move the header to Office.
  const OFFICE = { id: "o1", label: "Office", address: "2nd floor, Mahoba Road, near the bus stand, Chhatarpur 471001", pin_code: "110016", lat: 24.9437, lng: 79.5833, last_used_at: "2026-11-04T10:00:00Z" };
  const HOME = { id: "h1", label: "Home", address: "C-128, Green Avenue Colony, Satai Road, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
  await context.route((url) => url.pathname === "/rest/v1/addresses", (r) => (r.request().method() === "GET"
    ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify([HOME, OFFICE]) })
    : r.fallback()));
  await page.reload();
  await expect(sheet(page)).toBeVisible();   // proves the sheet shows with both rows before the tap
  await sheet(page).getByRole("button", { name: /^Office\b/ }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the menu, not an empty screen
  await expect(page.getByRole("button", { name: /^Office\b/ })).toBeVisible();   // the header now names Office, not Home
});
