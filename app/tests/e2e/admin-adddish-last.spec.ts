// Story 1476 (owner's design rule 8, as #1457): on the Add dish form the main button is last. "Not now" (outline) is left and "Add dish" (filled) is right, an equal pair (story 1699),
// and when the form opens both buttons are fully in view (the kitchen page has no tab bar).
// Story #1700: the form is its own screen (head with Back, the fields, the pair in a foot under one flat line); Back, Not now and the phone Back leave with no save.
import { test, expect, type Page, type BrowserContext, type Locator } from "@playwright/test";
import { setup } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

async function open(page: Page, context: BrowserContext) {
  const net = await setup(context, page);
  nets.set(page, net);
  net.state.admin = true;
  net.state.menu = Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, name: `Dish ${i}`, price_paise: 20000, image_url: null, image_credit: null }));   // a real menu: the form opens below the fold
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await expect(page.getByLabel("Dish name")).toBeVisible();
}

const nets = new WeakMap<Page, Awaited<ReturnType<typeof setup>>>();
const rect = (loc: Locator) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const oneLine = (loc: Locator) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().height < 1.5 * (parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2); });

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S1 Given the form is open at ${w}x${h}, then Not now (left) and Add dish (right) are an equal pair on one line that fills the form`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, context);
    expect(await page.locator(".ui-bottom .ui-row-pair > .ui-btn").allTextContents()).toEqual(["Not now", "Add dish"]);
    const [noBtn, addBtn] = [page.getByRole("button", { name: "Not now" }), page.getByRole("button", { name: "Add dish" })];
    const [a, b, f] = [await rect(noBtn), await rect(addBtn), await rect(page.locator(".ui-bottom .ui-row-pair"))];
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

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S3 Given the form is open at ${w}x${h}, then it is its own screen: Back and the title on top, no tab bar, both buttons in view with no scroll, one flat line above them`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, context);
    await expect(page.getByRole("heading", { name: "Add a dish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hauz Khas Kitchen" })).toHaveCount(0);
    await expect(page.locator(".ui-tabs")).toHaveCount(0);
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
    for (const name of ["Not now", "Add dish"]) {
      const b = (await page.getByRole("button", { name }).boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `${name} is on the screen`).toBeLessThanOrEqual(h);
    }
    const foot = page.locator(".ui-bottom");
    expect(await foot.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
    expect((await rect(foot)).w).toBe(w);
    expect(await page.locator(".ui-scroll .ui-bottom").count()).toBe(0);   // the foot is outside the scroll
  });
}

test("S4 Back, Not now and the phone Back leave with no save and return to the menu where the user left", async ({ page, context }) => {
  await open(page, context);
  const net = nets.get(page)!;
  const list = page.getByRole("heading", { name: "Menu" });
  const here = async () => page.locator(".ui-scroll").evaluate((e) => e.scrollTop);
  await page.getByLabel("Dish name").fill("Half typed");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(list).toBeVisible();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(list).toBeVisible();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(list).toBeVisible();
  await expect(page.getByLabel("Dish name")).toHaveCount(0);
  expect(net.calls.menuWrites).toHaveLength(0);
  expect(await here()).toBeGreaterThan(0);   // the add button was below the fold: the user comes back to that place
});

test("S5 two fast taps on Add dish are one call, and the button is disabled while it runs", async ({ page, context }) => {
  await open(page, context);
  const net = nets.get(page)!;
  await page.route(/menu_items/, async (r) => { if (r.request().method() === "POST") await new Promise((ok) => setTimeout(ok, 800)); await r.fallback(); });
  await page.getByLabel("Dish name").fill("Dal Makhani");
  await page.getByLabel("Price (₹)").fill("220");
  await page.getByLabel("Category").fill("Mains");
  const add = page.getByRole("button", { name: "Add dish" });
  await add.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  await expect(add).toBeDisabled();
  await page.waitForTimeout(1500);
  expect(net.calls.menuWrites.filter((w) => w.method === "POST")).toHaveLength(1);
});

test("S6 at 360x640 a failed save shows its line in view above the foot", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, context);
  await page.getByLabel("Dish name").fill("Dal Makhani");   // no price: the rule line comes
  await page.getByRole("button", { name: "Add dish" }).click();
  const a = page.getByRole("alert");
  await expect(a).toBeVisible();
  await page.waitForTimeout(900);
  const [ab, foot] = [(await a.boundingBox())!, (await page.locator(".ui-bottom").boundingBox())!];
  expect(ab.y).toBeGreaterThanOrEqual(0);
  expect(ab.y + ab.height).toBeLessThanOrEqual(foot.y);
});
