// Story #973: the zigzag under the menu header runs the full content width, left gutter to right gutter, at every phone width.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const width of [360, 390, 412]) {
  test(`S1 at ${width} px the zigzag spans the content width, gutter to gutter`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await setup(context, page);
    await page.goto("/customer/");
    const zig = page.locator(".ui-greet .ui-zigzag");
    await expect(zig).toBeVisible();
    const [z, g] = await Promise.all([zig.boundingBox(), page.locator(".ui-greet").boundingBox()]);
    const gutter = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ui-greet")!).paddingLeft));
    expect(Math.round(z!.x)).toBe(Math.round(g!.x + gutter));                      // starts at the left gutter
    expect(Math.round(z!.x + z!.width)).toBe(Math.round(g!.x + g!.width - gutter)); // ends at the right gutter
    expect(Math.round(z!.width)).toBeGreaterThan(width - 2 * gutter - 2);           // not a stub
  });
}
