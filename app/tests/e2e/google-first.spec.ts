// Story #1155: with the settings read failing (and no build gate), the first screen is Google-first. Never the number screen.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 a failed settings read lands on Google-first, with no number box", async ({ page, context }) => {
  const net = await setup(context, page, [], { guest: true });
  net.state.otpLogin = "down";
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toHaveCount(0);
  await expect(page.getByLabel("Mobile", { exact: true })).toHaveCount(0);
});
