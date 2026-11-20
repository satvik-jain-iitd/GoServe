// Story #1161 (QA screen 19, design rule 8): the filled button of the dish sheet is LAST. Story 1694 (owner, 20 Nov 2026, epic 1690): Close (outline) and Add (filled) are a half and half pair on one line,
// Close left; the label is "Add", no price; the price in the sheet's head is price x count. The stepper buttons are 44 px or more wide (Apple HIG).
import { test, expect, type Locator, type Page } from "@playwright/test";
import { setup } from "./helpers";

const SIZES = [[360, 640], [390, 844], [412, 915]];
const rect = (loc: Locator) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const lines = (loc: Locator) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });
async function open(page: Page, context: Parameters<typeof setup>[0], w = 390, h = 844) {
  await setup(context, page);
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Butter Chicken details" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Butter Chicken" });
  await expect(sheet).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  return sheet;
}

test("S1 the stepper buttons are 44 px wide or more", async ({ page, context }) => {
  const sheet = await open(page, context);
  const steps = await sheet.locator(".ui-step button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(steps.length).toBe(2);
  for (const w of steps) expect(w).toBeGreaterThanOrEqual(44);
});

for (const [w, h] of SIZES) {
  test(`S1b Close and Add are a half and half pair, Close left, equal, one line each, together as wide as the actions' content (${w}x${h})`, async ({ page, context }) => {
    const sheet = await open(page, context, w, h);
    const close = sheet.getByRole("button", { name: "Close", exact: true }), add = sheet.getByRole("button", { name: "Add", exact: true });
    const [a, b, act] = [await rect(close), await rect(add), await rect(sheet.locator(".ui-dish-act"))];
    const pad = await sheet.locator(".ui-dish-act").evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft), r: parseFloat(c.paddingRight) }; });
    expect(a.x).toBeLessThan(b.x);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.x - (act.x + pad.l))).toBeLessThanOrEqual(1);
    expect(Math.abs(b.x + b.w - (act.x + act.w - pad.r))).toBeLessThanOrEqual(1);
    for (const l of [await lines(close), await lines(add)]) expect(l.text).toBeLessThan(1.5 * l.line);
    await expect(add).toHaveText("Add");   // no price on the button
    expect(await add.evaluate((e) => e.classList.contains("ghost"))).toBe(false);
    expect(await close.evaluate((e) => e.classList.contains("ghost"))).toBe(true);
  });
}

test("S2 the head shows price x count: one plate Rs 320, two Rs 640; the name and the price box keep their place; the button still says Add", async ({ page, context }) => {
  const sheet = await open(page, context);
  const price = sheet.locator(".ui-dish-price"), name = sheet.locator(".ui-dish-head h2");
  await expect(price).toHaveText("₹320");
  const [n0, p0] = [await rect(name), await rect(price)];
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await expect(price).toHaveText("₹640");
  const [n1, p1] = [await rect(name), await rect(price)];
  expect(n1).toEqual(n0);   // the dish name does not move
  expect(Math.abs(p1.y - p0.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(p1.x + p1.w - (p0.x + p0.w))).toBeLessThanOrEqual(0.5);   // the price box keeps its right edge
  await expect(sheet.getByRole("button", { name: "Add", exact: true })).toHaveText("Add");
});

test("S3 Add puts the chosen count in the bill and closes the sheet", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill \(2\)/ })).toContainText("₹640");
});

// Story 1694: a big total and a long name keep the head apart: the name and the price do not touch, and the price is on one line.
for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S4 a five-digit total and a long name: the head keeps 8 px or more between them, the price on one line (${w}x${h})`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.menu = [{ id: "d1", name: "Butter Chicken Special Thali with Extra Gravy", price_paise: 9990000, image_url: null, image_credit: null }];   // Rs 99,900 each
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/customer/");
    await page.getByRole("button", { name: /details$/ }).first().click();
    const sheet = page.getByRole("dialog", { name: /Butter Chicken Special/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /^More / }).click();   // two plates
    const m = await sheet.locator(".ui-dish-head").evaluate((e) => {
      const n = e.querySelector("h2")!.getBoundingClientRect(), p = e.querySelector(".ui-dish-price")!, pr = p.getBoundingClientRect();
      const r = document.createRange(); r.selectNodeContents(p);
      return { text: p.textContent, nameRight: n.right, priceLeft: pr.left, gap: pr.left - n.right, priceH: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(p).lineHeight) || parseFloat(getComputedStyle(p).fontSize) * 1.2, nameH: n.height };
    });
    expect(m.gap).toBeGreaterThanOrEqual(8);
    expect(m.priceH).toBeLessThan(1.5 * m.line);
  });
}
