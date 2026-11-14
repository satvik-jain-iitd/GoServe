// Regression, screen 28: T4 and T5 Rider on the way, rider row and rider map. Cases: .claude/handoff/qa/screens/28-T4-T5.md (epic #1196). Reached with the shared steps STEPS["tracker-rider-row"] (the row) and the tap on it (the map).
// The clock is fixed at NINE, the time the shared steps were written for, so "updated 20 sec ago" and the door time are exact.
import { test, expect, type Page } from "@playwright/test";
import { STEPS, NINE } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const row = (page: Page) => page.getByRole("link", { name: "See the rider on Google Maps" });   // story 1498: the row opens Google Maps; the app's own map is gone
const slip = (page: Page) => page.getByRole("region", { name: "Order", exact: true });

test("TC 28.1 Order on the way: the On the way stamp, minutes, By time, the rider row with its words, the steps, Call the rider", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  await expect(slip(page).getByText("On the way", { exact: true })).toBeVisible();   // proves the on-the-way order shows before the rest is checked
  await expect(slip(page).getByText(/^\d+ min$/)).toBeVisible();
  await expect(slip(page).getByText(/^By \d{1,2}:\d{2} (am|pm)$/)).toBeVisible();
  await expect(row(page)).toContainText("Rahul is 1.2 km away");
  await expect(row(page)).toContainText("On the map · updated 20 sec ago");
  await expect(page.getByRole("list", { name: "Order progress" }).getByRole("listitem").filter({ hasText: "On the way" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("link", { name: "Call the rider" })).toHaveAttribute("href", "tel:9876543210");
  await expect(page.getByRole("region", { name: "Rider on the map" })).toHaveCount(0);   // story 1498: no map inside the app
});

test("TC 28.2 Tap the rider row: Google Maps opens with the route from the rider to the order's pin (story 1498)", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  await expect(row(page)).toContainText("Rahul is 1.2 km away");
  const href = new URL((await row(page).getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://www.google.com/maps/dir/");
  expect(href.searchParams.get("origin")).toMatch(/^28\.\d+,77\.\d+$/);        // the rider
  expect(href.searchParams.get("destination")).toMatch(/^28\.\d+,77\.\d+$/);   // the order's pin
  expect(href.searchParams.get("origin")).not.toBe(href.searchParams.get("destination"));
  await expect(row(page)).toHaveAttribute("target", "_blank");
});

test("TC 28.3 The phone loses its connection while the order is on the way: the row says No connection and when the rider was last seen", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  await expect(row(page)).toContainText("Rahul is 1.2 km away");   // proves the row is live before the phone goes offline
  await context.setOffline(true);
  await expect(row(page)).toContainText("No connection · Last seen");
});
