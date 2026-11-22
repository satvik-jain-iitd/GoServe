// Story #1172 (QA run 1, board T1-Cancelled): a cancelled order owes nothing, so the slip total reads "Nothing to pay" and ₹0, the same as a declined one. Words a customer sees are true for that customer (rule 20).
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";
import { setup, order } from "./helpers";

test("S1 a cancelled order's slip says Nothing to pay and ₹0, not Cash at door", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  const total = page.locator(".ui-slip-total");
  await expect(total).toContainText("Nothing to pay");
  await expect(total).toContainText("₹0");
  await expect(total).not.toContainText("Cash at door");
  await expect(page.getByText("Your order was cancelled. Nothing to pay.")).toHaveCount(0);   // story 1745: the slip says it once
});

test("S2 the History row of a cancelled order shows no price (story 1589: it owes nothing, the word is Cancelled)", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  await page.getByRole("button", { name: "Back to menu" }).click();   // the back arrow (story 1745: no main button of the same name)
  await page.getByRole("button", { name: "History" }).click();
  const row = page.locator(".ui-order-row").first();
  await expect(row).toContainText("Cancelled");
  await expect(row).not.toContainText("₹");
});

// Story 1434 (boards T1b and Delivered b, owner 13 Nov 2026): both end slips have one main button, "Back to menu", filled and last; "Call the kitchen" is the outline button above it.
// It opens the menu with an empty cart. "Order again" stays only on History (story #977). This reverses #1229.
const main = (page: Page) => page.locator(".ui-bottom").getByRole("button", { name: "Share feedback" });
async function lastIsMain(page: Page) {
  const kids = page.locator(".ui-bottom > *");
  await expect(kids.last()).toHaveText("Share feedback");
  await expect(kids.last()).not.toHaveClass(/ghost/);
  await expect(page.locator(".ui-bottom").getByRole("button", { name: "Back to menu" })).toHaveCount(0);
  await expect(page.locator(".ui-bottom").getByRole("link", { name: "Call support" })).toHaveClass(/ghost/);
  expect((await page.locator(".ui-bottom").getByRole("link", { name: "Call support" }).boundingBox())!.y).toBeLessThan((await main(page).boundingBox())!.y);
}

test("S3 a cancelled slip: Share feedback is the main button, last, under Call support; no Back to menu, no Order again (story 1745)", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.supportPhone = "9000000000";
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.locator(".ui-stamp", { hasText: "Cancelled" })).toBeVisible({ timeout: 5000 });
  await lastIsMain(page);
  await expect(page.getByRole("button", { name: "Order again", exact: true })).toHaveCount(0);
});

test("S4 the back arrow on a cancelled slip opens the menu with an empty cart, no Bill (story 1745: the main button is Share feedback)", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  await page.locator(".ui-head").getByRole("button", { name: "Back to menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);   // nothing from the cancelled order went in the cart
});

test("S5 a delivered slip: Share feedback is the main button, last, under Call support; no Order again, no Back to menu (stories 1676, 1658)", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.supportPhone = "9000000000";
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", { ...order("delivered", new Date().toISOString()), paid_by: "cash" });
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible({ timeout: 6000 });
  await expect(page.locator(".ui-bottom").getByRole("button", { name: /Order again|Back to menu/ })).toHaveCount(0);
  const main = page.locator(".ui-bottom .ui-btn").last();
  await expect(main).toHaveText("Share feedback");
  await expect(main).not.toHaveClass(/ghost/);
  expect((await page.getByRole("link", { name: "Call support" }).boundingBox())!.y).toBeLessThan((await main.boundingBox())!.y);
});
