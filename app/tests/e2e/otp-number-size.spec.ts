// Story #785 (E26): on the number screen the typed number is as big as the +91 and at least 16px (under 16px iOS Safari zooms the page on focus).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the typed mobile number has the font size of the +91 prefix, 16px or more", async ({ page, context }) => {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  const input = page.getByLabel("Mobile number");
  await input.fill("9876543210");
  const size = (sel: string) => page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const typed = await size("#otp-phone");
  const prefix = await size(".otp-phone span");
  expect(typed).toBeGreaterThanOrEqual(16);
  expect(typed).toBe(prefix);
});
