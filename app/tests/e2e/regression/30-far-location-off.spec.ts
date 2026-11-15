// Regression, screen 30: SW2 Far from Home and SW3 Location off. Cases: .claude/handoff/qa/screens/30-SW.md (epic 1196). Reached with the shared steps STEPS["menu-far"] and STEPS["location-off"].
// Story 1548: far from Home the place stays and the box "Where should we deliver?" asks (TC 30.1, 30.2).
// TC 30.5 (Use my current location: the phone asks, then the menu or the box) is owner only: a real phone's location prompt cannot be answered here.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { whereBox } from "../helpers";

test.use({ viewport: { width: 390, height: 844 } });

const sheet = (page: Page) => page.getByRole("dialog", { name: "Where to bring your food?" });
const header = (page: Page) => page.getByRole("button", { name: /^Home\b/ }).first();

test("TC 30.1 Look: the app 6 km from Home keeps Home in the header, and the box Where should we deliver? asks, with Use another address above and Use current location last (story 1548)", async ({ page, context }) => {
  await STEPS["menu-far"](context, page, "/customer/");
  await expect(whereBox(page)).toBeVisible();   // proves the box shows before its parts are checked
  await expect(whereBox(page).getByRole("heading", { name: "Where should we deliver?" })).toBeVisible();
  await expect(whereBox(page).getByRole("button")).toHaveText(["Use another address", "Use current location"]);
  await expect(header(page)).toBeVisible();
  await expect(header(page)).toContainText("Sample Garden Colony");   // Home stays in the header, with its address
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();   // the menu is there behind the box
});

test("TC 30.2 Tap Use current location: the pin map opens centred on my spot", async ({ page, context }) => {
  const asked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/functions/v1/serviceability")) asked.push(r.url()); });   // the map asks if we serve its centre once it rests
  await STEPS["menu-far"](context, page, "/customer/");
  await whereBox(page).getByRole("button", { name: "Use current location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
  // The phone is at 28.6139, 77.209: the map's centre must be there, not at Home (28.5677, 77.2432).
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  const at = new URL(asked.at(-1)!).searchParams;
  expect(Math.abs(Number(at.get("lat")) - 28.6139)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(Number(at.get("lng")) - 77.209)).toBeLessThanOrEqual(0.01);
});

test("TC 30.3 Look: location blocked shows the sheet Where to bring your food? with the true line, the saved address, View all, Try location again and Search your area last (bug 1526)", async ({ page, context }) => {
  await STEPS["location-off"](context, page, "/customer/");
  await expect(sheet(page)).toBeVisible();   // proves the sheet shows before its parts are checked
  await expect(sheet(page).getByRole("heading", { name: "Where to bring your food?" })).toBeVisible();
  await expect(sheet(page).getByRole("status")).toHaveText("Location is off or blocked. Pick a place.");
  await expect(sheet(page).getByRole("button", { name: "Try location again" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: /^Home\b/ })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "View all" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Search your area" })).toBeVisible();
});

test("TC 30.4 Tap a saved address in the sheet: the sheet closes and the menu is for that address", async ({ page, context }) => {
  await STEPS["location-off"](context, page, "/customer/");
  // Home and Office are both saved. Home is in the header before the tap, so the tap must move the header to Office.
  const OFFICE = { id: "o1", label: "Office", address: "2nd floor, Sample Road, near the bus stand, Sampletown 900001", pin_code: "110016", lat: 28.5947, lng: 77.2432, last_used_at: "2026-11-04T10:00:00Z" };
  const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sample Road, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
  await context.route((url) => url.pathname === "/rest/v1/addresses", (r) => (r.request().method() === "GET"
    ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify([HOME, OFFICE]) })
    : r.fallback()));
  await page.reload();
  await expect(sheet(page)).toBeVisible();   // proves the sheet shows with both rows before the tap
  await sheet(page).getByRole("button", { name: /^Office\b/ }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the menu, not an empty screen
  await expect(page.getByRole("button", { name: /^Office\b/ }).first()).toBeVisible();   // the header now names Office, not Home
});
