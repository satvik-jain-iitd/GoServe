// Regression, screen 25: T2 Declined, the kitchen said no. Cases: .claude/handoff/qa/screens/25-T2-Declined.md (epic #1196, story #1197). Reached with the shared step STEPS["declined"] only.
import { test, expect } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
const REASON = "We are out of butter chicken tonight, so this order cannot be made.";
test.use({ viewport: { width: 390, height: 844 } });

test("TC 25.1 Look: the red Declined stamp, Nothing to pay Rs 0, the kitchen's reason in quotes with the time, the money line, Order something else", async ({ page, context }) => {
  await STEPS["declined"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toBeVisible();   // proves the declined screen shows before anything is checked
  const stamp = page.locator(".ui-slip-stamp .ui-stamp");
  await expect(stamp).toHaveText("Declined");
  const stampColour = await stamp.evaluate((e) => getComputedStyle(e).color);
  const errorColour = await page.locator(".ui-declined").evaluate((e) => getComputedStyle(e).borderLeftColor);
  expect(stampColour, "stamp colour must be the error red used by the declined box").toBe(errorColour);
  const total = page.locator(".ui-slip-total");
  await expect(total).toContainText("Nothing to pay");
  await expect(total).toContainText("₹0");
  const box = page.getByRole("status").filter({ hasText: "could not take this order" });
  await expect(box).toBeVisible();
  await expect(box.getByText(`“${REASON}”`, { exact: true })).toBeVisible();   // the kitchen's own words, in curly quotes
  await expect(box.getByText(/^Declined \d{1,2}:\d{2} (am|pm) · 2 min after you ordered$/)).toBeVisible();   // placed 10:00, declined 10:02 in the fixture
  await expect(page.getByText("Your money is not taken. If you paid online, it comes back in 5 to 7 days.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Order something else" })).toBeVisible();
});

test("TC 25.2 Order something else: the menu opens with an empty bill", async ({ page, context }) => {
  await STEPS["declined"](context, page, PATH);
  await expect(page.getByRole("button", { name: "Order something else" })).toBeVisible();   // proves the button is there before the tap
  await page.getByRole("button", { name: "Order something else" }).click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();   // proves the menu shows before the bill is checked
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);   // no bill: no bar
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await expect(page.getByRole("button", { name: "View bill (1) · ₹320" })).toBeVisible();   // the bar counter is live: it appears on the first add
});
