// Story #1108 (TC 1.8): offline, Continue with Google stays in the app. It shows one line and never leaves for the browser's error page; online it works again.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("TC 1.8 offline tap on Continue with Google stays in the app and says so", async ({ page, context }) => {
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toBeVisible();
  await context.setOffline(true);
  await button.click();
  await expect(page.getByRole("alert")).toHaveText("No internet. Connect and tap again.");
  await expect(button).toBeVisible();   // still the welcome screen, the button is there
  expect(page.url()).toContain("/customer/");
  await context.setOffline(false);
  await button.click();   // online the same tap goes on (the line clears)
  await expect(page.getByRole("alert")).toHaveCount(0);
});
