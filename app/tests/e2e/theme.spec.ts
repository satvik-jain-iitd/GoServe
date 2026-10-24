// Story H10 (#193): Day and Night by the clock, the pin wins, and both themes pass the contrast check on the customer app. The network is answered by the test.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./helpers";

const at = (hour: number) => new Date(2026, 9, 24, hour, 0, 0);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test.describe("by the clock", () => {
  for (const [hour, want] of [[5, "night"], [6, "day"], [12, "day"], [17, "day"], [18, "night"], [23, "night"]] as const) {
    test(`S1 at ${String(hour).padStart(2, "0")}:00 the app is ${want}`, async ({ page, context }) => {
      await page.clock.install({ time: at(hour) });
      await setup(context, page);
      await page.goto("/customer/");
      await expect(page.locator("#root h2").first()).toBeVisible();
      expect(await theme(page)).toBe(want);
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", want === "night" ? "#0b1220" : "#e4e6d9");
    });
  }
});

test("S2 a pinned theme wins over the clock", async ({ page, context }) => {
  await page.clock.install({ time: at(20) });
  await context.addInitScript(() => localStorage.setItem("gs-theme", "day"));
  await setup(context, page);
  await page.goto("/customer/");
  expect(await theme(page)).toBe("day");
});

test("S2 a blocked storage still gives the theme of the clock", async ({ page, context }) => {
  await page.clock.install({ time: at(20) });
  await context.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await setup(context, page);
  await page.goto("/customer/");
  expect(await theme(page)).toBe("night");
});

for (const t of ["day", "night"] as const) {
  test(`S3 the first customer screen has no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    await setup(context, page);
    await page.goto("/customer/");
    await expect(page.locator("#root h2").first()).toBeVisible();
    const bad = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
