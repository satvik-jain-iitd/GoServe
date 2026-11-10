// Regression, screen 29: C2, C9 to C13 Deliver to and saved addresses. Cases: .claude/handoff/qa/screens/29-C2-Deliver.md (epic #1196). Reached with the shared steps STEPS["deliver-to"], ["deliver-five"], ["deliver-all"], ["deliver-empty"], ["deliver-removed"], ["edit-on-map"].
// TC 29.8 (two phones, same account) needs two real devices, so it is owner-only and not automated here.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const rowOf = (page: Page, label: string) => page.getByRole("listitem").filter({ hasText: label });
const deliverTo = (page: Page, label: string) => page.getByRole("button", { name: `Deliver to ${label}`, exact: true });

test("TC 29.1 Look: Back, Deliver to, 2 saved, search, Use current location, Add new address, rows with icon, label, Selected chip and the menu button", async ({ page, context }) => {
  await STEPS["deliver-to"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();   // proves the page shows before the parts are checked
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByText("2 saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use current location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add new address" })).toBeVisible();
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rowOf(page, "Home").getByText("Home", { exact: true })).toBeVisible();
  await expect(rowOf(page, "Office").getByText("Office", { exact: true })).toBeVisible();
  await expect(rowOf(page, "Home").getByText("C-4, Green Park Extension, New Delhi")).toBeVisible();
  for (const i of [0, 1]) await expect(rows.nth(i).locator("svg").first()).toBeVisible();   // each row starts with its icon
  await expect(rowOf(page, "Home").getByText("Selected", { exact: true })).toBeVisible();   // the one used last
  await expect(rowOf(page, "Office").getByText("Selected", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit or remove Home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit or remove Office" })).toBeVisible();
});

test("TC 29.2 Load: 5 saved shows 3 rows and View all; tapping View all shows all 5", async ({ page, context }) => {
  await STEPS["deliver-five"](context, page, PATH);
  const rows = page.getByRole("listitem");
  await expect(page.getByText("5 saved", { exact: true })).toBeVisible();   // proves the page shows with all five saved
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole("button", { name: "View all" })).toBeVisible();
  await page.getByRole("button", { name: "View all" }).click();
  await expect(rows).toHaveCount(5);
  await expect(page.getByRole("button", { name: "View all" })).toHaveCount(0);
  await expect(rowOf(page, "Shubhi")).toBeVisible();
});

test("TC 29.3 Empty: the pin icon and No saved address yet, no rows", async ({ page, context }) => {
  await STEPS["deliver-empty"](context, page, PATH);
  await expect(page.getByText("No saved address yet")).toBeVisible();   // proves the empty state shows
  const region = page.getByRole("region", { name: "Saved addresses" });
  await expect(region.locator("svg").first()).toBeVisible();   // the pin icon in its circle
  await expect(page.getByText("0 saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("TC 29.4 Tap a row: that address is chosen and the page goes back to the menu", async ({ page, context }) => {
  await STEPS["deliver-to"](context, page, PATH);
  await expect(deliverTo(page, "Office")).toBeVisible();   // proves the row shows before the tap
  await deliverTo(page, "Office").click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();   // the menu is back
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toHaveCount(0);
  const where = page.getByRole("button", { name: /^Office\b/ });
  await expect(where).toBeVisible();
  await expect(where).toContainText("Tower B, Connaught Place, New Delhi");
});

test("TC 29.5 Remove: the row goes, the dark bar says Home removed with the seconds and Undo; Undo brings it back", async ({ page, context }) => {
  await STEPS["deliver-removed"](context, page, PATH);
  const bar = page.getByRole("status").filter({ hasText: "Home removed" });
  await expect(bar).toBeVisible();   // proves the bar shows
  await expect(bar.getByText(/^[1-6] sec$/)).toBeVisible();   // the countdown is running from 6
  const dark = await bar.evaluate((e) => getComputedStyle(e).backgroundColor.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number));
  expect(Math.max(...dark), `bar colour ${dark}`).toBeLessThan(100);   // a dark bar
  await expect(page.getByText("2 saved", { exact: true })).toBeVisible();
  await expect(deliverTo(page, "Home")).toHaveCount(0);   // the row is gone
  await expect(deliverTo(page, "Office")).toBeVisible();
  await bar.getByRole("button", { name: "Undo" }).click();
  await expect(bar).toHaveCount(0);
  await expect(deliverTo(page, "Home")).toBeVisible();   // Undo brings it back
  await expect(page.getByText("3 saved", { exact: true })).toBeVisible();
});

test("TC 29.6 Edit: the map opens with Editing Home and Save changes", async ({ page, context }) => {
  await STEPS["edit-on-map"](context, page, PATH);
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();   // proves the map shows
  await expect(page.getByText("Editing Home", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);   // an edit saves, it does not confirm a new address
});

test("TC 29.7 Remove the selected address: another address becomes selected", async ({ page, context }) => {
  await STEPS["deliver-to"](context, page, PATH);
  await expect(page.getByRole("button", { name: "Edit or remove Home" })).toBeVisible();   // proves Home is there to remove
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Home removed" })).toBeVisible();
  // The delete waits out the Undo window (6 seconds); the bar goes away when it is done.
  await expect(page.getByRole("status").filter({ hasText: "Home removed" })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("1 saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  const where = page.getByRole("button", { name: /^Office\b/ });
  await expect(where).toBeVisible();   // the menu now shows Office as the address in use
  await expect(where).toContainText("Tower B, Connaught Place, New Delhi");
  await expect(page.getByRole("button", { name: /^Home\b/ })).toHaveCount(0);
});
