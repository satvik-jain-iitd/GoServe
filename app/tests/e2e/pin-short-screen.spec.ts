// Story 1392 (board A1p-OnboardPin): on a short screen (360 x 640) the Current Location button never covers the pin, and the pin stays at the centre
// of the map box, so the place the map reads is still the place the pin points at. At 390 x 844 the pin stays in the middle of the screen, as on the board.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";

const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);

for (const [w, h] of [[360, 640], [390, 844]] as const) {
  test(`S1 at ${w} x ${h} the pin is clear of the Current Location button and sits at the map's centre`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS["first-open-pin"](context, page, "/customer/");
    await expect(page.locator(".ui-pinmap-here")).toBeVisible();
    const pin = await box(page, ".ui-pinmap-pin");
    const here = await box(page, ".ui-pinmap-here");
    expect(overlap(pin, here), `pin ${JSON.stringify(pin)} under button ${JSON.stringify(here)}`).toBe(false);
    const map = await box(page, ".ui-pinmap-map");
    const point = pin.y + pin.height * 0.625;   // the pin's point: the box is moved up 62.5% of its height
    expect(Math.abs(point - (map.y + map.height / 2))).toBeLessThanOrEqual(1);
    if (h === 844) expect(Math.abs(point - h / 2)).toBeLessThanOrEqual(1);   // a tall screen keeps the board's middle
  });
}
