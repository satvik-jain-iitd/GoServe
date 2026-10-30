// Story #785 (E26): on the number screen the typed number is as big as the +91 and at least 16px (under 16px iOS Safari zooms the page on focus).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the typed mobile number is 16px or more", async ({ page, context }) => {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  const input = page.getByLabel("Mobile", { exact: true });
  await input.fill("9876543210");
  const size = (sel: string) => page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(await size("#otp-phone")).toBeGreaterThanOrEqual(16);
});

test("S2 no +91 is shown in the phone field, and a typed 10 digit number is sent as before (story #793)", async ({ page, context }) => {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  const sends: unknown[] = [];
  await context.route("https://test.supabase.co/functions/v1/otp/*", async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    sends.push(JSON.parse(route.request().postData() ?? "{}"));
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ ok: true, expires_in_s: 600 }) });
  });
  await page.goto("/customer/");
  const input = page.getByLabel("Mobile", { exact: true });
  await expect(input).toBeVisible();
  expect(await page.locator(".ui-field", { has: input }).innerText()).not.toContain("+91");
  await input.fill("7678296693");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect.poll(() => sends).toEqual([{ phone: "7678296693" }]);
});
