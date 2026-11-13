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

// Stories #1106 and #1107 (TC 1.13, TC 1.14): the owner's escape. Open online once, let the service worker take the page, go offline, open again from cold:
// the welcome screen is still O0g-B (not the phone-code screen) and the logo is a real picture, not a broken box.
test("TC 1.13 and 1.14 offline cold open keeps O0g-B and the logo (#1106, #1107)", async ({ page, context }) => {
  const net = await setup(context, page, [], { guest: true });
  net.state.otpLogin = false;   // the switch is off: the online read says so and the phone keeps it
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Sign in to start" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();   // the first load is not controlled by the worker; the second one is
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("gs-otp-last"))).toBe("0");   // the last read is kept
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to start" })).toBeVisible();
  await expect(page.getByText("Where do we reach you?")).toHaveCount(0);
  await expect.poll(() => page.locator("img.ui-lockup").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});
