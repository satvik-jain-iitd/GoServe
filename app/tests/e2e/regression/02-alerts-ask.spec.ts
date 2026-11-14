// Regression, screen 2: N0b Order alerts ask. Cases: .claude/handoff/qa/screens/02-N0b.md (epic #1196, story #1197). Reached with the shared step STEPS["alerts-ask"].
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// A phone whose permission answer and number of asks the test controls (it is installed before the shared step runs).
async function phone(context: BrowserContext, answer: "granted" | "denied" | "never", permission = "default") {
  await context.addInitScript(([ans, perm]) => {
    const w = window as unknown as { __asks: number; Notification: any };
    w.__asks = 0;
    if (typeof w.Notification === "undefined") w.Notification = function () {};
    w.Notification.requestPermission = () => { w.__asks++; return ans === "never" ? new Promise(() => {}) : Promise.resolve(ans); };
    Object.defineProperty(w.Notification, "permission", { get: () => perm, configurable: true });
  }, [answer, permission]);
}
const asks = (page: Page) => page.evaluate(() => (window as unknown as { __asks: number }).__asks);
const box = async (loc: import("@playwright/test").Locator) => (await loc.boundingBox())!;
const step3 = (page: Page) => expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();

test("TC 2.1 slip without a top line or step count, the title, the bell in a lime circle on the shared hero line", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);
  await expect(page.getByRole("group", { name: "Order alerts" })).toBeVisible();
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
  await expect(page.locator(".ui-slip-head")).toHaveCount(0);   // 1404: the slip has no top line either
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();
  const bell = await box(page.locator(".ui-bellbadge"));
  expect(Math.abs(bell.x + bell.width / 2 - 195)).toBeLessThanOrEqual(2);   // centred
  const slipTop = (await box(page.locator(".ui-slip"))).y;
  expect(Math.abs(bell.y - slipTop - 220)).toBeLessThanOrEqual(4);   // the hero line (ui.css top 220), the same number as screen 1's thali (157) and screen 3's pin
  const bg = await page.locator(".ui-bellbadge").evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");   // a filled circle, not bare
});

test("TC 2.2 I'll check the app myself is above, Turn on alerts is last, both full width, the slip ends 24 px above the bottom", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);
  const outline = await box(page.getByRole("button", { name: "I'll check the app myself" }));
  const filled = await box(page.getByRole("button", { name: "Turn on alerts" }));
  expect(outline.y + outline.height).toBeLessThanOrEqual(filled.y);   // outline above, filled last
  expect(Math.abs(outline.width - filled.width)).toBeLessThanOrEqual(2);
  const slip = await box(page.locator(".ui-slip"));
  expect(filled.width).toBeGreaterThan(slip.width - 60);   // full width of the slip body
  expect(Math.abs(844 - (slip.y + slip.height) - 24)).toBeLessThanOrEqual(4);
  await expect(page.locator(".ui-slip-body > button, .ui-slip-body > *").last()).toContainText("Turn on alerts");
});

test("TC 2.3 Turn on alerts, allow: the phone is asked once, then Where does the food go, no step count", async ({ page, context }) => {
  await phone(context, "granted");
  await STEPS["alerts-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Turn on alerts" }).click();
  await step3(page);
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
  expect(await asks(page)).toBe(1);
});

test("TC 2.4 Turn on alerts, block: moves on to Step 3, no hang, the buttons do not stay grey", async ({ page, context }) => {
  await phone(context, "denied");
  await STEPS["alerts-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Turn on alerts" }).click();
  await step3(page);
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
});

test("TC 2.4 (hang) a permission call that never answers still moves on after 8 seconds (#1116)", async ({ page, context }) => {
  await phone(context, "never");
  await page.clock.install();
  await STEPS["alerts-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Turn on alerts" }).click();
  await expect(page.getByRole("button", { name: "Turn on alerts" })).toBeDisabled();   // busy while it waits, not for good
  await page.clock.fastForward(8_500);
  await step3(page);
});

test("TC 2.5 I'll check the app myself moves on to Step 3 without asking the phone", async ({ page, context }) => {
  await phone(context, "granted");
  await STEPS["alerts-ask"](context, page, PATH);
  await page.getByRole("button", { name: "I'll check the app myself" }).click();
  await step3(page);
  expect(await asks(page)).toBe(0);
});

test("TC 2.6 alerts already allowed on this phone: Step 2 is skipped", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);   // the shared step shows Step 2 first (it sets permission to "default" itself)
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();   // proves the screen can show, so the next line can fail
  await context.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true }));   // then the phone allows alerts and the app opens again
  await page.reload();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toHaveCount(0);
});

test("TC 2.8 two fast taps on Turn on alerts ask the phone once", async ({ page, context }) => {
  await phone(context, "granted");
  await STEPS["alerts-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Turn on alerts" }).dblclick();
  await step3(page);
  expect(await asks(page)).toBe(1);
});

test("TC 2.9 close the app on this step and open it again: back on Step 2, not welcome", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to start" })).toHaveCount(0);
});

// Story #1336: on a short phone the round icon must not cover the buttons, and the outline button is as tall as the green one.
for (const [w, h] of [[360, 560], [360, 649], [360, 780], [390, 844]]) {
  test(`TC 2.10 the icon clears the buttons and both buttons are the same height at ${w} by ${h}${h < 649 ? " (may scroll)" : ", no scroll"}`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS["alerts-ask"](context, page, PATH);
    const hero = (await page.locator(".ui-bellbadge").boundingBox())!;
    const ghost = (await page.locator(".ui-slip .ui-btn.ghost.big").boundingBox())!;
    const main = (await page.locator(".ui-slip .ui-btn.big:not(.ghost)").boundingBox())!;
    expect(hero.y + hero.height, "the icon ends above the outline button").toBeLessThanOrEqual(ghost.y - 8);
    expect(Math.abs(ghost.height - main.height), "same button height").toBeLessThanOrEqual(1);
    if (h >= 649) {   // design rule 11: a screen that fit without scroll must still fit; 360 by 560 may scroll, so it is not checked
      const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
      expect(scrolls, "the page does not scroll").toBe(false);
      expect(main.y + main.height, "the green button is inside the viewport").toBeLessThanOrEqual(h);
    }
  });
}
