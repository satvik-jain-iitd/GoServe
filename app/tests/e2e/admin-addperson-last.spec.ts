// Story 1457 (board AP1): on the Add a person form the main button is last. "Not now" (outline) is left and "Add person" (filled) is right, an equal pair (story 1698),
// and when the form opens both buttons are fully in view, clear of the tab bar.
import { test, expect, type Locator } from "@playwright/test";
import { setup } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

const rect = (loc: Locator) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const oneLine = (loc: Locator) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().height < 1.5 * (parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2); });

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S1 Given the form is open at ${w}x${h}, then Not now (left) and Add person (right) are an equal pair on one line that fills the form`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    const net = await setup(context, page);
    net.state.admin = true;
    await page.goto("/admin/");
    await page.getByRole("button", { name: "City", exact: true }).click();
    await page.getByRole("button", { name: "Add a person" }).click();
    await page.waitForTimeout(600);   // the scroll into view settles
    expect(await page.locator(".ui-form-acts .ui-row-pair > .ui-btn").allTextContents()).toEqual(["Not now", "Add person"]);
    const [noBtn, addBtn] = [page.getByRole("button", { name: "Not now" }), page.getByRole("button", { name: "Add person" })];
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

test("S2 Given the form is open on a phone 390 x 844, then no part of either button is under the tab bar", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = Array.from({ length: 12 }, (_, i) => ({ kind: "rider", user_id: `r-${i}`, email: `rider${i}@example.com`, kitchen_id: null, kitchen_name: null }));   // a real city: the form opens below the fold
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.waitForTimeout(600);   // the scroll into view settles
  const bar = (await page.locator(".ui-tabs").boundingBox())!;
  for (const name of ["Not now", "Add person"]) {
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, `${name} is clear of the tab bar`).toBeLessThanOrEqual(bar.y);
  }
});
