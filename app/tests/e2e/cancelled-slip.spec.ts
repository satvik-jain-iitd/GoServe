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
  await expect(page.getByText("Your order was cancelled. Nothing to pay.")).toBeVisible();
});

test("S2 the History row of a cancelled order shows no price (story 1589: it owes nothing, the word is Cancelled)", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  await page.getByRole("button", { name: "Back to menu" }).first().click();   // the back arrow; story 1434 adds the main button of the same name
  await page.getByRole("button", { name: "History" }).click();
  const row = page.locator(".ui-order-row").first();
  await expect(row).toContainText("Cancelled");
  await expect(row).not.toContainText("₹");
});

// Story 1434 (boards T1b and Delivered b, owner 13 Nov 2026): both end slips have one main button, "Back to menu", filled and last; story 1656: there is no "Call the kitchen" on an end slip.
// It opens the menu with an empty cart. "Order again" stays only on History (story #977). This reverses #1229.
const main = (page: Page) => page.locator(".ui-bottom").getByRole("button", { name: "Back to menu" });
async function lastIsMain(page: Page) {
  const kids = page.locator(".ui-bottom > *");
  await expect(kids.last()).toHaveText("Back to menu");
  await expect(kids.last()).not.toHaveClass(/ghost/);
  await expect(page.locator(".ui-bottom").getByRole("link", { name: "Call the kitchen" })).toHaveCount(0);
}

test("S3 a cancelled slip: Back to menu is the main button and the only one, no Call the kitchen; no Order again", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  Object.assign(net.state.kitchens[0], { phone: "9876543210" });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled")).toBeVisible({ timeout: 5000 });
  await lastIsMain(page);
  await expect(page.getByRole("button", { name: "Order again", exact: true })).toHaveCount(0);
});

test("S4 Back to menu on a cancelled slip opens the menu with an empty cart, no Bill", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  await main(page).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);   // nothing from the cancelled order went in the cart
});

test("S5 a delivered slip: Order again (story 1589; before: Back to menu) is the main button and the only one, no Call the kitchen; it opens the Bill", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  Object.assign(net.state.kitchens[0], { phone: "9876543210" });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", { ...order("delivered", new Date().toISOString()), paid_by: "cash" });
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("button", { name: "See the menu" })).toHaveCount(0);
  const again = page.locator(".ui-bottom .ui-btn").last();
  await expect(again).toHaveText(/Order again ›/);
  await expect(again).not.toHaveClass(/ghost/);
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveCount(0);
  await again.click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
});
