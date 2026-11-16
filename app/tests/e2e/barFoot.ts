// Story 1572: the Bill's bar ends 24 px above the screen edge (plus the safe area, 0 here). The Menu "View bill" bar keeps what it had: 73 px above the edge, over the tab bar. By measure in the browser.
// Shared cases, run by Chromium (bar-foot.spec.ts) and by WebKit (bar-foot.webkit.spec.ts).
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const gap = (page: Page) => page.evaluate(() => { const b = document.querySelector(".ui-sticky .ui-btn")!.getBoundingClientRect(); return { gap: Math.round((window.innerHeight - b.bottom) * 10) / 10, h: Math.round(b.height * 10) / 10 }; });

export function barFoot() {
  for (const [width, height] of [[360, 640], [390, 844], [412, 915]]) {
    test(`the Menu bar keeps its place (73 px above the edge, as on dev), the Bill bar has 24 px (${width}x${height})`, async ({ page, context }) => {
      await page.setViewportSize({ width, height });
      await setup(context, page, []);
      await page.goto("/customer/");
      await page.getByRole("button", { name: "Add Butter Chicken" }).click();
      await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();
      expect(await gap(page)).toEqual({ gap: 73, h: 56 });   // as on dev
      await page.getByRole("button", { name: /View bill/ }).click();
      await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
      expect(await gap(page)).toEqual({ gap: 24, h: 56 });
    });
  }
}
