// Story #972, board F1-Filter: the filter sheet has a checkbox per category (multi-select); the veg switch applies to the whole menu; no jump list.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const dish = (id: string, name: string, category: string, veg: boolean) => ({ id, name, price_paise: 10000, category, veg, available: true, image_url: null, image_credit: null });
const MENU = [dish("d1", "Dal Makhani", "Mains", true), dish("d2", "Butter Chicken", "Mains", false), dish("d3", "Tandoori Roti", "Breads", true), dish("d4", "Keema Naan", "Breads", false),
  dish("d5", "Jeera Rice", "Rice", true), dish("d6", "Gulab Jamun", "Sweets", true)];

const open = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Filter" }).click();
  return page.getByRole("dialog", { name: "Filter" });
};
const dishes = (page: Page) => page.locator("article.ui-tile, .ui-dish-row, article").filter({ has: page.getByRole("button", { name: /^Add / }) });

test("S1 the sheet lists each category as a checkbox with its count, in a Categories group, and has no jump list", async ({ page, context }) => {
  const sheet = await open(page, context);
  const group = sheet.getByRole("group", { name: "Categories" });
  for (const name of ["Mains", "Breads", "Rice", "Sweets"]) await expect(group.getByRole("checkbox", { name })).toBeVisible();
  await expect(group.getByRole("checkbox", { name: "Mains" })).not.toBeChecked();
  await expect(sheet.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
  await expect(sheet.getByText("6 of 6 dishes")).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Clear all" })).toHaveCount(0);   // nothing ticked
});

test("S2 tick Breads: only breads show and the count says so; tick Rice too: both show", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("checkbox", { name: "Breads" }).check();
  await expect(sheet.getByText("2 of 6 dishes")).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Rice" }).check();
  await expect(sheet.getByText("3 of 6 dishes")).toBeVisible();
  await sheet.getByRole("button", { name: "Show dishes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const n of ["Tandoori Roti", "Keema Naan", "Jeera Rice"]) await expect(page.getByRole("heading", { name: n })).toBeVisible();
  for (const n of ["Dal Makhani", "Butter Chicken", "Gulab Jamun"]) await expect(page.getByRole("heading", { name: n })).toHaveCount(0);
  await page.getByRole("button", { name: "Filter" }).click();   // Close keeps the ticks
  await expect(page.getByRole("dialog", { name: "Filter" }).getByRole("checkbox", { name: "Breads" })).toBeChecked();
});

test("S3 Clear all (shown only when something is ticked) brings the whole menu back", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("checkbox", { name: "Sweets" }).check();
  await expect(sheet.getByText("1 of 6 dishes")).toBeVisible();
  await sheet.getByRole("link", { name: "Clear all" }).click();
  await expect(sheet.getByText("6 of 6 dishes")).toBeVisible();
  await expect(sheet.getByRole("checkbox", { name: "Sweets" })).not.toBeChecked();
  await expect(sheet.getByRole("link", { name: "Clear all" })).toHaveCount(0);
});

test("S4 Veg only with Breads shows only the veg breads", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("switch", { name: /Veg only/ }).check();
  await sheet.getByRole("checkbox", { name: "Breads" }).check();
  await expect(sheet.getByText("1 of 6 dishes")).toBeVisible();
  await sheet.getByRole("button", { name: "Show dishes" }).click();
  await expect(page.getByRole("heading", { name: "Tandoori Roti" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keema Naan" })).toHaveCount(0);
});

test("S5 ticks that match nothing show the Nothing matches card with the way out", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("switch", { name: /Veg only/ }).check();
  await sheet.getByRole("checkbox", { name: "Mains" }).check();
  await sheet.getByRole("checkbox", { name: "Mains" }).uncheck();
  await sheet.getByRole("button", { name: "Show dishes" }).click();
  await page.getByRole("searchbox", { name: "Search dishes" }).fill("zzz");
  await expect(page.getByText("Nothing matches")).toBeVisible();
  await expect(page.getByText("Try another word or clear the filters.")).toBeVisible();
});

// Story 1400 (owner, 13 Nov 2026, DECIDED, board F1t-FilterThali): the filter lists Thali as its first row, with a count; the rows add up to the total.
test("S9 a Thali row is first in the list with its count; ticking it alone keeps the thali and hides the other group", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [dish("m1", "Dal Makhani", "Mains", true), dish("m2", "Butter Chicken", "Mains", false), dish("t1", "Veg Thali", "Thali", true), dish("t2", "Chicken Thali", "Thali", false)];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Filter" }).click();
  const sheet = page.getByRole("dialog", { name: "Filter" });
  const rows = sheet.getByRole("group", { name: "Categories" }).getByRole("checkbox");
  await expect(rows.first()).toHaveAccessibleName(/^Thali\b/);   // first row
  await expect(sheet.getByRole("group", { name: "Categories" }).locator("label").first()).toContainText("2");   // its count
  await expect(sheet.getByText("4 of 4 dishes")).toBeVisible();   // the rows add up: 2 thalis + 2 mains
  await rows.first().check();
  await expect(sheet.getByText("2 of 4 dishes")).toBeVisible();
  await sheet.getByRole("button", { name: "Show dishes" }).click();
  await expect(page.getByText("Veg Thali").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toHaveCount(0);
});

test("S10 a kitchen with no thali has no Thali row", async ({ page, context }) => {
  const sheet = await open(page, context);
  await expect(sheet.getByRole("checkbox", { name: "Thali" })).toHaveCount(0);
});

// Story 1400, review of 13 Nov: category is free text. Thalis under "Thali" and "Special Thali" are all one Thali row, and the tick keeps all of them.
test("S11 thalis under two category words give one Thali row, and ticking it keeps every thali", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [dish("m1", "Dal Makhani", "Mains", true), dish("t1", "Veg Thali", "Thali", true), dish("t2", "Chicken Special Thali", "Special Thali", false)];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Filter" }).click();
  const sheet = page.getByRole("dialog", { name: "Filter" });
  const group = sheet.getByRole("group", { name: "Categories" });
  await expect(group.getByRole("checkbox", { name: /^Thali\b/ })).toHaveCount(1);
  await expect(group.locator("label").first()).toContainText("2");   // both thalis in one row
  await group.getByRole("checkbox", { name: /^Thali\b/ }).check();
  await expect(sheet.getByText("2 of 3 dishes")).toBeVisible();   // the tick keeps both
});

// Story 1717: the filter button says only "Show dishes" in every state (the sheet head carries the count); it keeps its place, width and one line.
for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
  test(`S11 the filter button is exactly Show dishes at ${vp.width}x${vp.height}, one line, 44 tall, and does not move when the count changes`, async ({ page, context }) => {
    await page.setViewportSize(vp);
    const sheet = await open(page, context);
    const btn = sheet.getByRole("button", { name: "Show dishes", exact: true });
    await expect(sheet.getByText("6 of 6 dishes")).toBeVisible();
    await page.waitForTimeout(600);   // the sheet has finished sliding in
    const before = (await btn.boundingBox())!;
    expect(before.height).toBeGreaterThanOrEqual(44);
    const lines = () => btn.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getClientRects().length; });
    expect(await lines()).toBe(1);
    console.log("MB-PX", vp.width, JSON.stringify(before));
    await sheet.getByRole("checkbox", { name: "Sweets" }).check();   // one dish
    await expect(sheet.getByText("1 of 6 dishes")).toBeVisible();
    await expect(btn).toBeVisible();
    await sheet.getByRole("checkbox", { name: "Breads" }).check();   // three dishes
    await expect(sheet.getByText("3 of 6 dishes")).toBeVisible();
    expect(await lines()).toBe(1);
    await page.waitForTimeout(600);
    const after = (await btn.boundingBox())!;
    expect({ x: after.x, width: after.width, height: after.height }).toEqual({ x: before.x, width: before.width, height: before.height });   // same width; the sheet grows upward from the bottom (Clear all appears), so the foot of the button stays put
    expect(vp.height - (after.y + after.height)).toBeCloseTo(vp.height - (before.y + before.height), 0);
    expect(after.y).toBeCloseTo(before.y, 0);   // story 1719: the row for Clear all is always there, so the button does not move at all
  });
}

// Story 1719: Clear all is whole, at least 44 tall, never under or touching the button; the button never moves; with many categories the list scrolls, the button does not.
const MANY = Array.from({ length: 12 }, (_, i) => dish(`x${i}`, `Dish ${i}`, `Group ${i}`, true));
for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
  test(`S12 Clear all is whole, 44 tall and 8 clear of the button with one and with all ticked at ${vp.width}x${vp.height}`, async ({ page, context }) => {
    await page.setViewportSize(vp);
    const sheet = await open(page, context);
    const group = sheet.getByRole("group", { name: "Categories" });
    const link = sheet.getByRole("link", { name: "Clear all" });
    const btn = sheet.getByRole("button", { name: "Show dishes", exact: true });
    await page.waitForTimeout(600);
    const check = async (label: string) => {
      await expect(link).toBeVisible();
      const l = (await link.boundingBox())!, b = (await btn.boundingBox())!, sh = (await sheet.boundingBox())!;
      console.log("CA-PX", vp.width, label, "link", JSON.stringify(l), "btn", JSON.stringify(b), "sheet", JSON.stringify(sh));
      expect(l.height).toBeGreaterThanOrEqual(44);
      expect(b.y - (l.y + l.height)).toBeGreaterThanOrEqual(8);   // a gap, so no touching and no overlap
      expect(l.y).toBeGreaterThanOrEqual(sh.y);
      expect(l.y + l.height).toBeLessThanOrEqual(sh.y + sh.height);
    };
    await group.getByRole("checkbox", { name: "Breads" }).check();
    await check("one");
    for (const n of ["Mains", "Rice", "Sweets"]) await group.getByRole("checkbox", { name: n }).check();
    await check("all");
  });

  test(`S13 the button and the sheet do not move when a category is ticked, and Clear all is hidden from keys and readers until then at ${vp.width}x${vp.height}`, async ({ page, context }) => {
    await page.setViewportSize(vp);
    const sheet = await open(page, context);
    const btn = sheet.getByRole("button", { name: "Show dishes", exact: true });
    await page.waitForTimeout(600);
    await expect(sheet.getByRole("link", { name: "Clear all" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Clear all" })).toHaveCount(0);
    const link = sheet.locator(".ui-clear");
    await link.evaluate((e) => (e as HTMLElement).focus());
    expect(await link.evaluate((e) => document.activeElement === e)).toBe(false);   // not focusable, so not in the tab order
    const b0 = (await btn.boundingBox())!, s0 = (await sheet.boundingBox())!;
    await sheet.getByRole("checkbox", { name: "Breads" }).check();
    await expect(sheet.getByRole("link", { name: "Clear all" })).toBeVisible();
    await page.waitForTimeout(600);
    const b1 = (await btn.boundingBox())!, s1 = (await sheet.boundingBox())!;
    for (const k of ["x", "y", "width", "height"] as const) expect(b1[k]).toBeCloseTo(b0[k], 0);
    expect(s1.height).toBeCloseTo(s0.height, 0);
    expect(s1.y).toBeCloseTo(s0.y, 0);
  });

  test(`S14 with 12 categories the list scrolls and the button does not at ${vp.width}x${vp.height}`, async ({ page, context }) => {
    await page.setViewportSize(vp);
    const net = await setup(context, page);
    net.state.menu = MANY;
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Filter" }).click();
    const sheet = page.getByRole("dialog", { name: "Filter" });
    const group = sheet.getByRole("group", { name: "Categories" });
    const btn = sheet.getByRole("button", { name: "Show dishes", exact: true });
    await page.waitForTimeout(600);
    const dims = await group.evaluate((e) => ({ sh: e.scrollHeight, ch: e.clientHeight }));
    expect(dims.sh).toBeGreaterThan(dims.ch);   // the list scrolls
    const b0 = (await btn.boundingBox())!;
    expect(b0.y + b0.height).toBeLessThanOrEqual(vp.height);   // the button is on screen
    await group.evaluate((e) => { e.scrollTop = e.scrollHeight; });
    await page.waitForTimeout(200);
    const b1 = (await btn.boundingBox())!;
    expect(b1.y).toBeCloseTo(b0.y, 0);
    expect(await sheet.evaluate((e) => e.scrollTop)).toBe(0);   // the sheet itself does not scroll
  });
}
