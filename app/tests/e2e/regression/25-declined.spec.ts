// Regression, screen 25: T2 Declined, the kitchen said no. Cases: .claude/handoff/qa/screens/25-T2-Declined.md (epic #1196, story #1197). Reached with the shared step STEPS["declined"] only.
import { test, expect } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
const REASON = "We are out of butter chicken tonight, so this order cannot be made.";
test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });   // the fixture times are UTC: placed 10:00 UTC is 3:30 pm in India, declined 10:02 UTC is 3:32 pm

// Reads "rgb(r, g, b)" or "rgba(r, g, b, a)" into [r, g, b].
const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);

test("TC 25.1 Look: the red Declined stamp, Nothing to pay Rs 0, the kitchen's reason in quotes with the time, the money line, Order something else", async ({ page, context }) => {
  await STEPS["declined"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toBeVisible();   // proves the declined screen shows before anything is checked
  const stamp = page.locator(".ui-slip-stamp .ui-stamp");
  await expect(stamp).toHaveText("Declined");
  const stampColour = await stamp.evaluate((e) => getComputedStyle(e).color);
  const box = page.getByRole("status").filter({ hasText: "could not take this order" });
  await expect(box).toBeVisible();
  const boxBorder = await box.evaluate((e) => getComputedStyle(e).borderLeftColor);
  expect(stampColour, "stamp colour must be the error red used by the declined box").toBe(boxBorder);
  const [r, g, b] = rgb(stampColour);
  expect(r > 150 && r > 2 * g && r > 2 * b, `stamp must be red, got ${stampColour}`).toBe(true);
  const total = page.locator(".ui-slip-total");
  await expect(total).toContainText("Nothing to pay");
  await expect(total).toContainText("₹0");
  await expect(box.getByText(`“${REASON}”`, { exact: true })).toBeVisible();   // the kitchen's own words, in curly quotes
  await expect(box.getByText("Declined 3:32 pm · 2 min after you ordered", { exact: true })).toBeVisible();   // placed 10:00 UTC, declined 10:02 UTC, shown in India time
  await expect(page.getByText(/^Your money is not taken\./)).toBeVisible();
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

test("TC 25.3 Copy: a cash order says nothing was charged, without the online-payment line", async ({ page, context }) => {
  await STEPS["declined"](context, page, PATH);
  await expect(page.getByText(/^Your money is not taken\./)).toBeVisible();   // proves the money line is on screen, so the absence check below is not blind
  await expect(page.getByText(/^Your money is not taken\./)).toHaveCount(1);   // the counter is live: it finds the line
  test.fail(true, "#1251: a declined cash order says If you paid online, it comes back in 5 to 7 days");
  await expect(page.getByText(/paid online/)).toHaveCount(0);
});
