// Story 1476 (owner's design rule 8, as #1457): on the Add dish form the main button is last. "Not now" (outline) is left and "Add dish" (filled) is right, an equal pair (story 1699),
// and when the form opens both buttons are fully in view (the kitchen page has no tab bar).
import { test, expect, type Page, type BrowserContext, type Locator } from "@playwright/test";
import { setup } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

async function open(page: Page, context: BrowserContext) {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.menu = Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, name: `Dish ${i}`, price_paise: 20000, image_url: null, image_credit: null }));   // a real menu: the form opens below the fold
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await expect(page.getByLabel("Dish name")).toBeVisible();
}

const rect = (loc: Locator) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const oneLine = (loc: Locator) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().height < 1.5 * (parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2); });

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S1 Given the form is open at ${w}x${h}, then Not now (left) and Add dish (right) are an equal pair on one line that fills the form`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, context);
    expect(await page.locator(".ui-form-acts .ui-row-pair > .ui-btn").allTextContents()).toEqual(["Not now", "Add dish"]);
    const [noBtn, addBtn] = [page.getByRole("button", { name: "Not now" }), page.getByRole("button", { name: "Add dish" })];
    const [a, b, f] = [await rect(noBtn), await rect(addBtn), await rect(page.locator(".ui-form-acts"))];
    expect(a.x).toBeLessThan(b.x);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
    expect(a.h).toBeGreaterThanOrEqual(44);
    expect(Math.abs(a.x - f.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.x + b.w - (f.x + f.w))).toBeLessThanOrEqual(1);
    expect(await oneLine(noBtn)).toBe(true);
    expect(await oneLine(addBtn)).toBe(true);
  });
}

test("S2 Given the form is open on a phone 390 x 844, then both buttons are fully on the screen", async ({ page, context }) => {
  await open(page, context);
  await page.waitForTimeout(600);   // the scroll into view settles
  for (const name of ["Not now", "Add dish"]) {
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, `${name} is on the screen`).toBeLessThanOrEqual(844);
  }
});
