// Story #932: the page cannot be pinched, and the bottom tabs never scroll away.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 html allows panning only (touch-action pan-x pan-y), so a pinch does nothing", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe("pan-x pan-y");
});

test("S2 a Safari pinch (gesturestart) is cancelled by the running app", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(await page.evaluate(() => { const e = new Event("gesturestart", { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented; })).toBe(true);
});

test("S3 scrolling a long menu leaves the bottom tabs where they are", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  const tabs = page.getByRole("button", { name: "My orders" });
  const before = await tabs.boundingBox();
  await page.mouse.wheel(0, 3000);
  const after = await tabs.boundingBox();
  expect(after!.y).toBe(before!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
