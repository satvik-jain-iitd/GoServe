// Story 821: every screen listed in docs/screens.txt is rendered and compared with its accepted picture (tests/e2e/screens-baseline).
// A screen that changed without anyone meaning it turns the App job red. Adding a screen means adding a line to docs/screens.txt, not a spec.
// SCREENS_OUT=<dir> also writes each render there (scripts/screens.sh), so the render can be looked at without the comparison.
import { test, expect } from "@playwright/test";
import { NINE, STEPS, screens } from "./screensSteps";


test("every screen in docs/screens.txt is listed with a known setup step", () => {
  expect(screens.length).toBeGreaterThan(0);
  for (const s of screens) expect(Object.keys(STEPS), `${s.name}: unknown setup step "${s.step}"`).toContain(s.step);
});

for (const s of screens) {
  test(`screen ${s.name} matches its accepted picture`, async ({ page, context }) => {
    await page.clock.install({ time: NINE });
    await page.setViewportSize({ width: s.width, height: s.height });
    await STEPS[s.step](context, page, s.path);
    await page.evaluate(() => document.fonts.ready);
    if (process.env.SCREENS_OUT) await page.screenshot({ path: `${process.env.SCREENS_OUT}/${s.name}.png` });
    if (process.env.SCREENS_RENDER_ONLY) return;
    await expect(page).toHaveScreenshot(`${s.name}.png`);
  });
}
