// Story #1046 (board O0): the zigzag shows whole triangles from edge to edge. A mask of one triangle per tile, `round` on x, so a whole number of tiles fits the width.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

// Per column, how many pixels of the element's picture have the zigzag colour. A whole triangle touches the edge column with its base corner only (about one pixel);
// half a triangle (the old two-gradient drawing) shows a slope of several pixels there.
async function columns(page: Page, selector: string, token = "--gs-zigzag"): Promise<number[]> {
  const el = page.locator(selector).first();
  const png = (await el.screenshot()).toString("base64");
  const colour = await page.evaluate((t) => { const d = document.createElement("i"); d.style.color = `var(${t})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, token);
  return page.evaluate(async ({ png, colour }) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext("2d")!; ctx.drawImage(bmp, 0, 0);
    const want = colour.match(/\d+/g)!.slice(0, 3).map(Number);
    const out: number[] = [];
    for (let x = 0; x < cv.width; x++) {
      let n = 0;
      for (let y = 0; y < cv.height; y++) { const p = ctx.getImageData(x, y, 1, 1).data; if (Math.abs(p[0] - want[0]) + Math.abs(p[1] - want[1]) + Math.abs(p[2] - want[2]) < 40) n++; }
      out.push(n);
    }
    return out;
  }, { png, colour });
}

for (const width of [412, 375]) {
  test(`S1 at ${width} px the mark under the greeting starts and ends with a whole triangle`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await setup(context, page);
    await page.goto("/customer/");
    await expect(page.locator(".ui-greet .ui-zigzag")).toBeVisible();
    const cols = await columns(page, ".ui-greet .ui-zigzag");
    const top = Math.max(...cols);
    expect(top).toBeGreaterThanOrEqual(7);                     // apexes in between (the picture is device pixels, so this is a floor)
    expect(cols[0]).toBeLessThanOrEqual(top / 4);              // the left edge is the base corner of a triangle, not the middle of a slope
    expect(cols[cols.length - 1]).toBeLessThanOrEqual(top / 4);   // and so is the right edge
  });
}

test("S2 the mark and the slip teeth are one-triangle masks with round on x, not two gradients", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.locator(".ui-greet .ui-zigzag")).toBeVisible();
  const mark = await page.locator(".ui-greet .ui-zigzag").evaluate((e) => { const c = getComputedStyle(e); return { repeat: c.getPropertyValue("mask-repeat") || c.getPropertyValue("-webkit-mask-repeat"), image: c.getPropertyValue("mask-image") || c.getPropertyValue("-webkit-mask-image"), bg: c.backgroundImage }; });
  expect(mark.repeat).toMatch(/^round/);
  expect(mark.image).toContain("svg");
  expect(mark.bg).not.toContain("gradient");
});

test("S3 the teeth on top of a slip are the same mask with round on x", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(page.locator(".ui-slip")).toBeVisible();
  const teeth = await page.locator(".ui-slip").evaluate((s) => { const c = getComputedStyle(s, "::before"); return { repeat: c.getPropertyValue("mask-repeat") || c.getPropertyValue("-webkit-mask-repeat"), bg: c.backgroundImage }; });
  expect(teeth.repeat).toMatch(/^round/);
  expect(teeth.bg).not.toContain("gradient");
});
