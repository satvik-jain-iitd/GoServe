// Story H10 (#193) and #225: Day at any hour, the pin wins, and both themes pass the contrast check on the customer app. The network is answered by the test.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const at = (hour: number) => new Date(2026, 9, 24, hour, 0, 0);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test.describe("day at any hour (#225)", () => {
  for (const [hour, want] of [[5, "day"], [6, "day"], [12, "day"], [17, "day"], [18, "day"], [23, "day"]] as const) {
    test(`S1 at ${String(hour).padStart(2, "0")}:00 the app is ${want}`, async ({ page, context }) => {
      await page.clock.install({ time: at(hour) });
      await setup(context, page);
      await page.goto("/customer/");
      await expect(page.locator("#root h2").first()).toBeVisible();
      expect(await theme(page)).toBe(want);
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#e4e6d9");   // the Day bar colour
    });
  }
});

test("S2 a pinned Night wins over the default", async ({ page, context }) => {
  await page.clock.install({ time: at(12) });
  await context.addInitScript(() => localStorage.setItem("gs-theme", "night"));
  await setup(context, page);
  await page.goto("/customer/");
  expect(await theme(page)).toBe("night");
});

test("S2 a blocked storage still gives Day", async ({ page, context }) => {
  await page.clock.install({ time: at(20) });
  await context.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await setup(context, page);
  await page.goto("/customer/");
  expect(await theme(page)).toBe("day");
});

for (const t of ["day", "night"] as const) {
  test(`S3 the first customer screen has no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    await setup(context, page);
    await page.goto("/customer/");
    await expect(page.locator("#root h2").first()).toBeVisible();
    expect(await axeScan(page)).toEqual([]);
  });
}
