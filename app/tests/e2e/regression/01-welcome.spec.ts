// Regression, screen 1: O0g-C Welcome, Google only. Cases: .claude/handoff/qa/screens/01-O0g-C.md (story #1178). Reached with the shared step STEPS.welcome.
import { test, expect } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
const reach = (context: Parameters<typeof STEPS.welcome>[0], page: Parameters<typeof STEPS.welcome>[1]) => STEPS.welcome(context, page, PATH);
const box = async (loc: import("@playwright/test").Locator) => (await loc.boundingBox())!;

test.use({ viewport: { width: 390, height: 844 } });

test("TC 1.1 lockup, tagline on one line, slip without a top line or step count, the title", async ({ page, context }) => {
  await reach(context, page);
  await expect(page.getByRole("heading", { name: "Sign in to start" })).toBeVisible();
  await expect(page.getByText("Welcome", { exact: true })).toHaveCount(0);   // 1404: the slip label is gone
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
  await expect(page.locator(".ui-slip-head")).toHaveCount(0);   // 1404: the slip has no top line either
  await expect(page.getByRole("img", { name: "GoServe" })).toBeVisible();
  const tag = page.getByText("Hot meals from our kitchen for you in 20 mins");
  const lineHeight = await tag.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect((await box(tag)).height).toBeLessThan(lineHeight * 1.5);   // one line
});

test("TC 1.2 the thali is centred, on the same hero line as the bell on step 2", async ({ page, context, browser }) => {
  await reach(context, page);
  const thali = await box(page.locator(".ui-thali"));   // board O0g-F (stories 1371 to 1374): the thali that sets itself
  expect(Math.abs(thali.x + thali.width / 2 - 195)).toBeLessThanOrEqual(2);
  const slipTop = (await box(page.locator(".ui-slip"))).y;
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const next = await other.newPage();
  await STEPS["alerts-ask"](other, next, PATH);
  const bell = await box(next.locator(".ui-bellbadge"));
  // The shared hero line: board O0g-F puts the thali top 123 px under the slip top (the plate centre 268), the bell top is 220; the boxes are measured.
  expect(Math.abs(thali.y - slipTop - 123)).toBeLessThanOrEqual(4);
  expect(Math.abs(bell.y - slipTop - 220)).toBeLessThanOrEqual(4);
});

test("TC 1.3 Continue with Google is last in the slip and the slip ends 24 px above the bottom", async ({ page, context }) => {
  await reach(context, page);
  const slip = await box(page.locator(".ui-slip"));
  expect(Math.abs(844 - (slip.y + slip.height) - 24)).toBeLessThanOrEqual(4);
  await expect(page.locator(".ui-slip-body > *").last().getByRole("button", { name: "Continue with Google" })).toBeVisible();   // the button is the last thing in the slip
});

test("TC 1.4 at 375 x 667 the whole button shows without scrolling", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await reach(context, page);
  const b = await box(page.getByRole("button", { name: "Continue with Google" }));
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(667);
});

test("TC 1.8 airplane mode: our own line, the button stays, never the browser's error page", async ({ page, context }) => {
  await reach(context, page);
  const button = page.getByRole("button", { name: "Continue with Google" });
  await context.setOffline(true);
  await button.click();
  await expect(page.getByRole("alert")).toHaveText(/^No internet\./);
  await expect(button).toBeVisible();
  expect(page.url()).toContain(PATH);
});

test("TC 1.9 two fast taps start one Google sign-in, not two", async ({ page, context }) => {
  await reach(context, page);
  let starts = 0;
  await context.route("**/auth/v1/authorize**", async (route) => { starts++; await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" }); });
  const button = page.getByRole("button", { name: "Continue with Google" });
  await button.dblclick();
  await page.waitForTimeout(800);
  expect(starts).toBe(1);
});

test("TC 1.12 largest phone text size: the title wraps to 2 lines at most and the button shows", async ({ page, context }) => {
  await reach(context, page);
  const title = page.getByRole("heading", { name: "Sign in to start" });
  const before = await title.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  // Largest Android text size is a 1.5x scale of every text, px or rem: set each element's computed size x1.5 (the boxes keep their own widths).
  await page.evaluate(() => { for (const e of document.querySelectorAll<HTMLElement>("main, main *")) e.style.setProperty("font-size", `${parseFloat(getComputedStyle(e).fontSize) * 1.5}px`, "important"); });
  const after = await title.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(after, "the text size really grew").toBeGreaterThan(before * 1.3);
  const lineHeight = await title.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect((await box(title)).height).toBeLessThanOrEqual(lineHeight * 2.2);
  const b = await box(page.getByRole("button", { name: "Continue with Google" }));
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  expect(b.y + b.height).toBeLessThanOrEqual(844);
});
