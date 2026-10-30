// Story 803: the welcome screen (board O0) matches its approved board: label "Mobile", a "10 digit number" hint, the number inside a 48 px bordered box
// (the input 44 px, DM Mono 18 px), and Google as a big ghost button the height of Send code.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the welcome screen carries the board's label, hint, box and Google button", async ({ page, context }) => {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  const input = page.getByLabel("Mobile", { exact: true });
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute("placeholder", "10 digit number");
  const box = page.locator(".otp-phone");
  const h = async (l: typeof box) => (await l.boundingBox())!.height;
  expect(await h(box)).toBe(48);
  expect(await h(input)).toBe(44);
  const style = await box.evaluate((el) => { const s = getComputedStyle(el); return { w: s.borderTopWidth, r: s.borderTopLeftRadius }; });
  expect(style).toEqual({ w: "1px", r: "6px" });
  expect(await input.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
  expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(18);
  const google = page.getByTestId("google-signin");
  await expect(google).toHaveClass(/\bghost\b.*\bbig\b|\bbig\b.*\bghost\b/);
  expect(await h(google)).toBe(await h(page.getByRole("button", { name: "Send code" })));
});
