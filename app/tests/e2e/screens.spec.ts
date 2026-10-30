// Story 821: every screen listed in docs/screens.txt is rendered and compared with its accepted picture (tests/e2e/screens-baseline).
// A screen that changed without anyone meaning it turns the App job red. Adding a screen means adding a line to docs/screens.txt, not a spec.
// SCREENS_OUT=<dir> also writes each render there (scripts/screens.sh), so the render can be looked at without the comparison.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setup } from "./helpers";

type Screen = { name: string; path: string; width: number; height: number; step: string };
const screens: Screen[] = readFileSync(resolve(import.meta.dirname, "../../../docs/screens.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [name, path, vp, step] = l.split("|").map((x) => x.trim());
    const [width, height] = vp.split("x").map(Number);
    return { name, path, width, height, step };
  });

const NINE = new Date(2026, 9, 27, 9, 0, 0);   // the greeting depends on the clock
const gateOn = (context: BrowserContext) => context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });

// The steps below are the ones the other specs already use to reach these screens.
const STEPS: Record<string, (context: BrowserContext, page: Page, path: string) => Promise<void>> = {
  welcome: async (context, page, path) => { await setup(context, page); await gateOn(context); await page.goto(path); await expect(page.getByLabel("Mobile", { exact: true })).toBeVisible(); },
  menu: async (context, page, path) => { await setup(context, page); await page.goto(path); await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible(); },
  bill: async (context, page, path) => {
    await setup(context, page); await page.goto(path);
    await page.getByRole("button", { name: "Add Butter Chicken" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  },
  account: async (context, page, path) => { await setup(context, page); await page.goto(path); await page.getByRole("button", { name: "Account" }).click(); await expect(page.getByTestId("account")).toBeVisible(); },
  orders: async (context, page, path) => { await setup(context, page); await page.goto(path); await page.getByRole("button", { name: "My orders" }).click(); await page.waitForLoadState("networkidle"); },
};

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
