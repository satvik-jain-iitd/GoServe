// Story #254: the four phone screenshots for the Play listing, 1080 by 1920 (a 360 by 640 phone at 3x).
// Not part of CI. To make them: cp ops/play/shots.spec.ts app/tests/e2e/zz-play-shots.spec.ts, then in app/:
//   PLAY_SHOTS=1 PLAY_OUT=<folder> CI=1 npx playwright test zz-play-shots --project=chromium --workers=1; rm tests/e2e/zz-play-shots.spec.ts
// Menu, bill and story come from the dev app (read only, nothing is ordered); the tracker comes from the local build with the test harness (an order being cooked).
import { test, type Page, type BrowserContext } from "@playwright/test";
import { order, setup } from "./helpers";

const DEV = "https://goserve-app-dev.vercel.app";
const OUT = process.env.PLAY_OUT ?? ".";
test.skip(!process.env.PLAY_SHOTS, "only to make the Play screenshots");
test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "en-IN", timezoneId: "Asia/Kolkata" });

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/screenshot-${name}.png` });
const pin = (context: BrowserContext, p: string) => context.addInitScript((v) => { try { localStorage.setItem("gs-pin", v); localStorage.setItem("gs-theme", "day"); } catch { /* blocked */ } }, p);

test("1 menu", async ({ page, context }) => {
  await pin(context, "110019");
  await page.goto(`${DEV}/customer/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add Veg Thali/ }).waitFor();
  await page.waitForTimeout(1500);
  await shot(page, "1-menu");
});

test("2 bill", async ({ page, context }) => {
  await pin(context, "110019");
  await page.goto(`${DEV}/customer/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add Veg Thali/ }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByRole("heading", { name: "Your bill" }).waitFor();
  await page.waitForTimeout(1200);
  await shot(page, "2-bill");
});

test("3 tracker", async ({ page, context }) => {
  await setup(context, page, [order("preparing", new Date().toISOString(), new Date(Date.now() - 6 * 60_000).toISOString())]);
  await page.goto("/customer/");
  await page.getByRole("heading", { name: "Your order", exact: true }).waitFor();
  await page.waitForTimeout(1200);
  await shot(page, "3-tracker");
});

test("4 story (the four doors)", async ({ page, context }) => {
  await pin(context, "110019");
  await page.goto(`${DEV}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Which hand/ }).waitFor();
  await page.evaluate(() => document.querySelector('section[aria-label="Pick your door"]')!.scrollIntoView({ block: "start" }));   // the four doors, whole
  await page.waitForTimeout(1200);
  await shot(page, "4-story");
});
