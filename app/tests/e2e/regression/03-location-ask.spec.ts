// Regression, screen 3: A1c Where does the food go. Cases: .claude/handoff/qa/screens/03-A1c.md (epic #1196, story #1197). Reached with the shared step STEPS["first-open-ask"].
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// A phone whose location answer the test controls (installed before the shared step runs).
async function phone(context: BrowserContext, answer: "blocked" | "never") {
  await context.addInitScript((ans) => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => { if (ans === "blocked") setTimeout(() => fail({ code: 1 }), 0); },   // "never": no answer at all
    } });
  }, answer);
}
const box = async (loc: import("@playwright/test").Locator) => (await loc.boundingBox())!;
const map = (page: Page) => page.getByRole("region", { name: "Pin map" });

test("TC 3.1 slip without a top line or step count, the title, the pin in a lime circle on the shared hero line", async ({ page, context }) => {
  await STEPS["first-open-ask"](context, page, PATH);
  await expect(page.getByRole("group", { name: "Your address" })).toBeVisible();
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
  await expect(page.locator(".ui-slip-head")).toHaveCount(0);   // 1404: the slip has no top line either
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  const pin = await box(page.locator(".ui-pinbadge"));
  expect(Math.abs(pin.x + pin.width / 2 - 195)).toBeLessThanOrEqual(2);   // centred
  const slipTop = (await box(page.locator(".ui-slip"))).y;
  expect(Math.abs(pin.y - slipTop - 220)).toBeLessThanOrEqual(4);   // the hero line, the same number as screen 2's bell
  const bg = await page.locator(".ui-pinbadge").evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
});

test("TC 3.2 Search for my address is above, Use my current location is last, the slip ends 24 px above the bottom", async ({ page, context }) => {
  await STEPS["first-open-ask"](context, page, PATH);
  const outline = await box(page.getByRole("button", { name: "Search for my address" }));
  const filled = await box(page.getByRole("button", { name: "Use my current location" }));
  expect(outline.y + outline.height).toBeLessThanOrEqual(filled.y);
  expect(Math.abs(outline.width - filled.width)).toBeLessThanOrEqual(2);
  const slip = await box(page.locator(".ui-slip"));
  expect(Math.abs(844 - (slip.y + slip.height) - 24)).toBeLessThanOrEqual(4);
  await expect(page.locator(".ui-slip-body > button").last()).toContainText("Use my current location");
});

test("TC 3.3 Use my current location, allow: the pin map opens centred on my spot", async ({ page, context }) => {
  const looked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/functions/v1/geocode")) looked.push(r.url()); });   // the map asks for the words at its centre once it settles
  await STEPS["first-open-pin"](context, page, PATH);   // the shared step gives the phone 24.8847, 79.597 and taps the button
  await expect(map(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
  await expect.poll(() => looked.at(-1) ?? "").toContain("lat=24.88");   // centred where the phone is (a map in the wrong place asks for another spot)
  expect(looked.at(-1)).toContain("lng=79.59");
});

test("TC 3.4 Use my current location, block: the map opens with search ready, no dead end", async ({ page, context }) => {
  await phone(context, "blocked");
  await STEPS["first-open-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(map(page)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeFocused();
});

test("TC 3.5 Search for my address: the pin map opens with the search box, no separate typing screen (story 1126)", async ({ page, context }) => {
  await STEPS["first-open-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Search for my address" }).click();
  await expect(map(page)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeFocused();
  await expect(page.getByLabel("Pin code")).toHaveCount(0);
});

test("TC 3.6 the location is slow: the button says it is finding me, and manual search stays usable", async ({ page, context }) => {
  await phone(context, "never");
  await STEPS["first-open-ask"](context, page, PATH);
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByRole("button", { name: "Finding you…" })).toBeDisabled();
  await page.getByRole("button", { name: "Search for my address" }).click();
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeVisible();
});

test("TC 3.7 close the app on this step and open it again: back on Step 3", async ({ page, context }) => {
  await STEPS["first-open-ask"](context, page, PATH);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
});

// Story #1336: on a short phone the round icon must not cover the buttons, and the outline button is as tall as the green one.
for (const [w, h] of [[360, 560], [360, 649], [360, 780], [390, 844]]) {
  test(`TC 3.8 the icon clears the buttons and both buttons are the same height at ${w} by ${h}${h < 649 ? " (may scroll)" : ", no scroll"}`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS["first-open-ask"](context, page, PATH);
    const hero = (await page.locator(".ui-pinbadge").boundingBox())!;
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
