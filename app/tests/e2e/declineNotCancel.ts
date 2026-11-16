// Story #1602: an order the kitchen declined with a reason reads Declined, even when the same person placed it (the database records cancelled_by kitchen). Guard on the screen side.
// Shared cases, run by Chromium (decline-not-cancel.spec.ts) and by WebKit (decline-not-cancel.webkit.spec.ts).
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const REASON = "We are out of butter chicken tonight, so this order cannot be made.";

export function declineNotCancel() {
  test("S1 a decline by the kitchen reads Declined with its words on the slip and in History", async ({ page, context }) => {
    await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancelled_by: "kitchen", cancel_reason: REASON }]);
    await page.goto("/customer/");
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.locator(".ui-order-row .ui-order-word.bad")).toHaveText("Declined");
    await page.getByRole("button", { name: /Butter Chicken/ }).click();
    await expect(page.getByRole("heading", { name: "Declined" })).toBeVisible();
    await expect(page.getByText(`“${REASON}”`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cancelled" })).toHaveCount(0);
  });
}
