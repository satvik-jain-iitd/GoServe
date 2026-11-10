// Story #1172 (QA run 1, board T1-Cancelled): a cancelled order owes nothing, so the slip total reads "Nothing to pay" and ₹0, the same as a declined one. Words a customer sees are true for that customer (rule 20).
import { test, expect } from "@playwright/test";
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

test("S2 the History row of a cancelled order shows ₹0", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  await page.getByRole("button", { name: "Back to menu" }).click();   // Order again now opens the Bill (#1229); the back arrow is the way to the tabs
  await page.getByRole("button", { name: "History" }).click();
  const row = page.locator(".ui-order-row").first();
  await expect(row).toContainText("₹0");
  await expect(row).not.toContainText("₹640");
});

test("S3 Order again on a cancelled slip opens the Bill with the same dishes at today's prices (bug #1229)", async ({ page, context }) => {
  await STEPS.cancelled(context, page, "/customer/");
  await page.getByRole("button", { name: "Order again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(page.getByText("₹640").first()).toBeVisible();   // 2 x 320 at today's price
});

test("S4 Order again on a cancelled slip with the kitchen closed: no bill, the menu says the kitchen is closed (bug #1229 fallback)", async ({ page, context }) => {
  await page.clock.setFixedTime(new Date("2026-10-24T06:30:00Z"));   // 12:00 India, outside the hours set below
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled")).toBeVisible({ timeout: 5000 });
  Object.assign(net.state.kitchens[0], { open: false, opens_at: "18:00:00", closes_at: "22:00:00" });
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await page.getByRole("button", { name: "Order again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible();
});
