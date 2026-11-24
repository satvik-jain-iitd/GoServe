// Story 1457 (board AP1): on the Add a person form the main button is last. "Not now" (outline) is left and "Add person" (filled) is right, an equal pair (story 1698),
// and when the form opens both buttons are fully in view.
// Story #1700: the form is its own screen (no tab bar, the pair in a foot under one flat line); Back, Not now and the phone Back leave with no save.
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
    expect(await page.locator(".ui-bottom .ui-row-pair > .ui-btn").allTextContents()).toEqual(["Not now", "Add person"]);
    const [noBtn, addBtn] = [page.getByRole("button", { name: "Not now" }), page.getByRole("button", { name: "Add person" })];
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

const CITY = Array.from({ length: 12 }, (_, i) => ({ kind: "rider", user_id: `r-${i}`, email: `rider${i}@example.com`, kitchen_id: null, kitchen_name: null }));   // a real city: the add button is below the fold

test("S2 Given the form is open on a phone 390 x 844, then it is its own screen with both buttons in view and no tab bar", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = CITY;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "Add a person" }).click();
  await expect(page.getByRole("heading", { name: "Add a person" })).toBeVisible();
  await expect(page.locator(".ui-tabs")).toHaveCount(0);
  for (const name of ["Not now", "Add person"]) {
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, `${name} is on the screen`).toBeLessThanOrEqual(844);
  }
  expect(await page.locator(".ui-bottom").evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
  expect(await page.locator(".ui-scroll .ui-bottom").count()).toBe(0);
});

test("S3 Back, Not now and the phone Back leave with no save and return to the city where the user left", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = CITY;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  const add = page.getByRole("button", { name: "Add a person" });
  await add.scrollIntoViewIfNeeded();
  const scroller = page.locator(".ui-scroll");
  const at = await scroller.evaluate((e) => e.scrollTop);
  expect(at).toBeGreaterThan(0);
  await add.click();
  await page.getByLabel("Email").fill("x@example.com");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(add).toBeVisible();
  await add.click();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(add).toBeVisible();
  await add.click();
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(add).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  expect(net.calls.rpc.filter((c) => c.name === "admin_add_person")).toHaveLength(0);
  expect(Math.abs((await scroller.evaluate((e) => e.scrollTop)) - at)).toBeLessThanOrEqual(2);
});
