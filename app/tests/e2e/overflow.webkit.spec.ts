// Story #999: on an iPhone (WebKit) no screen of docs/screens.txt scrolls sideways, and no sheet scrolls sideways inside itself.
// Cause it guards (owner, 8 Nov 2026): iOS Safari gives a time box its own minimum width; the fix of story 923 lived in one form only, and the Edit kitchen sheet slid sideways.
import { test, expect } from "@playwright/test";
import { NINE, STEPS, screens } from "./screensSteps";

for (const s of screens) {
  test(`overflow ${s.name} stays inside the iPhone width`, async ({ page, context }) => {
    await page.clock.install({ time: NINE });
    await STEPS[s.step](context, page, s.path);
    await page.evaluate(() => document.fonts.ready);
    const wide = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      sheets: [...document.querySelectorAll<HTMLElement>(".ui-sheet")].map((el) => el.scrollWidth - el.clientWidth),
      // Playwright's WebKit does not draw the iPhone time box at its own minimum width, so the rule itself is checked too: every date or time box may shrink, and no sheet may scroll sideways.
      boxes: [...document.querySelectorAll<HTMLInputElement>('input[type="time"], input[type="date"], input[type="datetime-local"]')].map((el) => getComputedStyle(el).minWidth),
      sheetX: [...document.querySelectorAll<HTMLElement>(".ui-sheet")].map((el) => getComputedStyle(el).overflowX),
    }));
    expect(wide.page, `${s.name}: the page is ${wide.page}px wider than the screen`).toBeLessThanOrEqual(0);
    for (const m of wide.boxes) expect(m, `${s.name}: a date or time box keeps its own minimum width`).toBe("0px");
    for (const x of wide.sheetX) expect(x, `${s.name}: a sheet can scroll sideways`).toBe("hidden");
    for (const w of wide.sheets) expect(w, `${s.name}: a sheet scrolls ${w}px sideways`).toBeLessThanOrEqual(0);
  });
}
