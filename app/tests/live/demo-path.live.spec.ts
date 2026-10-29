// Story #56 S1: the 90-second demo path on the real dev app: order, kitchen steps, AI suggestion, rider steps, delivered, reset.
import { test, expect } from "@playwright/test";

test("S1 demo path: menu, order, kitchen, AI suggestion, delivered, reset", async ({ page }) => {
  await page.goto("/console/");
  const dishes = page.getByRole("button", { name: /^Add / });
  await dishes.first().waitFor({ timeout: 20_000 });
  await dishes.nth(0).click();
  await dishes.nth(1).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4, Green Park, Delhi");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByText(/Order [0-9a-f]{8}/)).toBeVisible({ timeout: 15_000 });
  for (const step of ["Accept", "Start", "Ready"]) {
    await page.getByRole("button", { name: new RegExp(`^${step} `) }).click();
    await page.waitForTimeout(600);
  }

  await page.getByRole("button", { name: "Ops" }).click();
  await expect(page.getByText(/AI suggests rider .*The rule agrees/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("metric-decision")).toBeVisible();

  await page.getByRole("button", { name: "Customer" }).click();
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.locator("[aria-current=step]").filter({ hasText: "Delivered" })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Yes, clear" }).click();
  await expect(page.getByText("Demo cleared.")).toBeVisible({ timeout: 10_000 });
});
