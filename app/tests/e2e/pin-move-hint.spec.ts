// Story 1389 (board PH1, owner 13 Nov 2026): a small dark bubble right above the pin, "Move the map to set the pin".
// It shows on every use of the pin map until this person has moved the map once on this phone. A move the app makes does not count.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";

const TEXT = "Move the map to set the pin";
const bubble = (page: Page) => page.getByRole("status").filter({ hasText: TEXT });
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
async function drag(page: Page) {
  const map = await box(page, ".ui-pinmap-map");
  await page.mouse.move(map.x + map.width / 2, map.y + 200);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width / 2 + 120, map.y + 260, { steps: 8 });
  await page.mouse.up();
}

for (const [w, h] of [[390, 844], [360, 640]] as const) {
  test(`H1 at ${w} x ${h} the bubble shows right above the pin and covers nothing`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS["first-open-pin"](context, page, "/customer/");
    await expect(bubble(page)).toBeVisible();
    const b = (await bubble(page).boundingBox())!;
    const pin = await box(page, ".ui-pinmap-pin svg path");   // the marker itself, not its halo
    expect(Math.abs(b.x + b.width / 2 - (pin.x + pin.width / 2))).toBeLessThanOrEqual(1);
    expect(b.y + b.height).toBeLessThanOrEqual(pin.y);
    expect(pin.y - (b.y + b.height)).toBeLessThanOrEqual(40);   // the board: 26 px from the tail tip (28 from the box) to the marker path
    for (const sel of [".ui-pinmap-pin svg path", ".ui-pinmap-card", ".ui-pinmap-top", ".ui-pinmap-here"]) expect(overlap(b, await box(page, sel)), sel).toBe(false);
    expect(await bubble(page).evaluate((e) => e === document.activeElement || e.contains(document.activeElement))).toBe(false);
  });
}

test("H1b at 320 x 568 there is no room under the top row: the bubble is not shown, and nothing hides under the search bar", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  await expect(page.locator(".ui-pinmap-card")).toBeVisible();
  if (await bubble(page).isVisible()) expect(overlap((await bubble(page).boundingBox())!, await box(page, ".ui-pinmap-top"))).toBe(false);
  else await expect(page.getByText(TEXT)).toBeHidden();
});

test("H2 a drag hides it at once; the map opened again on this phone never shows it", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await expect(bubble(page)).toBeVisible();
  await drag(page);
  await expect(bubble(page)).toHaveCount(0);
  const again = await context.newPage();
  await again.goto("/customer/");
  await again.getByRole("button", { name: "Set delivery location" }).click();
  await expect(again.getByRole("button", { name: "Current Location" })).toBeVisible();
  await expect(again.locator(".ui-pinmap-card")).toBeVisible();
  await expect(bubble(again)).toHaveCount(0);
});

test("H3 Current Location alone does not hide it, and Confirm without a move shows it again next time", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect(bubble(page)).toBeVisible();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(bubble(page)).toHaveCount(0);   // not on the details step
  const again = await context.newPage();
  await again.goto("/customer/");
  await again.getByRole("button", { name: "Set delivery location" }).click();
  await expect(bubble(again)).toBeVisible();
});

test("H4 not while the search is open", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Search an area or address" }).click();
  await expect(bubble(page)).toHaveCount(0);
});
