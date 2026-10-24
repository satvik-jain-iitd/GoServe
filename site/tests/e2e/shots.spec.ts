// Release screenshots: SHOTS=../docs/mvp25/j3-shots npx playwright test shots. Skipped in normal runs.
import { test } from "@playwright/test";

const OUT = process.env.SHOTS;
test.skip(!OUT, "set SHOTS to a folder to take the screenshots");
for (const [w, h] of [[1280, 800], [390, 844]] as const) {
  for (const [path, name] of [["/", "home"], ["/investors", "investors"], ["/pre-register", "pre-register"]] as const) {
    test(`shot ${name} ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
    });
  }
}
