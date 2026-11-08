// Story #1115 (TC 1.15): a second account on the same phone never sees the first account's address, area or draft, and gets its own first open (N0, step 2 of 4).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("TC 1.15 a second account never sees the first account's address (#1115)", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.addInitScript(() => { Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true }); });
  // the phone holds account A's state; the signed-in session is account B's
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ user: { id: "account-B" } }));   // who is signed in now
    localStorage.setItem("gs-device-user", "account-A");   // who saved the device state
    localStorage.setItem("gs-pin", "110016");
    localStorage.setItem("gs_alerts_asked", "1");
    localStorage.setItem("gs-draft", JSON.stringify({ step: "menu", cart: {}, address: "A's home, Green Park", name: "A", phone: "9000000001" }));
  });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();   // a first open, not A's menu
  expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("gs-draft"))).not.toContain("A's home");
});
