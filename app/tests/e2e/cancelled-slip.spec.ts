// Story #1172 (QA run 1, board T1-Cancelled): a cancelled order owes nothing, so the slip total reads "Nothing to pay" and ₹0, the same as a declined one. Words a customer sees are true for that customer (rule 20).
import { test, expect } from "@playwright/test";
import { STEPS } from "./screensSteps";

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
  await page.getByRole("button", { name: /^(See the menu|Order again)$/ }).first().click();
  await page.getByRole("button", { name: "History" }).click();
  const row = page.locator(".ui-order-row").first();
  await expect(row).toContainText("₹0");
  await expect(row).not.toContainText("₹640");
});
