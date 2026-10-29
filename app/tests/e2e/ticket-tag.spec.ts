// Story (canvas audit, 29 Oct 2026): an accepted kitchen ticket shows an outlined "Accepted" tag, like a placed one, not the filled Cooking tag (the class ui-tag accepted had no rule).
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

test("S1 the Accepted tag on a kitchen ticket is outlined, not filled", async ({ page, context }) => {
  await setup(context, page, [order("accepted")]);
  await page.goto("/console/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("button", { name: "Cooking", exact: true }).click();   // an accepted ticket is on the Cooking tab
  const tag = page.locator(".ui-ticket .ui-tag.accepted");
  await expect(tag).toHaveText("Accepted");
  const css = await tag.evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, border: s.borderTopWidth }; });
  expect(css.bg).toBe("rgba(0, 0, 0, 0)");
  expect(parseFloat(css.border)).toBeGreaterThan(0);
});

test("S2 the placed tag is unchanged: outlined and muted", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await page.goto("/console/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  const tag = page.locator(".ui-ticket .ui-tag.placed");
  await expect(tag).toBeVisible();
  expect(await tag.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
});
