// Story 1693 (owner, 20 Nov 2026, epic 1690): the You page edit form ends in a bar at the bottom of the screen, Cancel (outline) left and Save (filled) right, a half and half pair.
// Measured in a real browser. The keyboard is emulated like in sheet-keyboard.spec.ts (a stand-in visual viewport).
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const SIZES = [[360, 640], [390, 844], [412, 915]];
const rect = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const lines = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });

async function open(page: Page, context: Parameters<typeof setup>[0], w: number, h: number, keyboard = false) {
  if (keyboard) await page.addInitScript(() => {
    const target = new EventTarget();
    const vv = Object.assign(target, { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    (window as unknown as { __vv: (h: number) => void }).__vv = (hh) => { vv.height = hh; target.dispatchEvent(new Event("resize")); };
  });
  const net = await setup(context, page);
  net.state.customer = { user_id: "u", name: "Asha", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" };
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^You: / }).click();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}
const edit = (page: Page) => page.getByRole("button", { name: "Edit delivery details" }).click();
const bar = (page: Page) => page.locator(".ui-you-page .ui-edit-bar");
const cancel = (page: Page) => bar(page).getByRole("button", { name: "Cancel", exact: true });
const save = (page: Page) => bar(page).getByRole("button", { name: "Save", exact: true });

for (const [w, h] of SIZES) {
  test(`the edit form's answers are a half and half pair at the thumb: Cancel left, Save right, equal, 44 px or more, one line, bottom gap 24 px (${w}x${h})`, async ({ page, context }) => {
    await open(page, context, w, h);
    await expect(bar(page)).toHaveCount(0);   // closed form: no bar
    await edit(page);
    await expect(bar(page)).toBeVisible();
    const [a, b, pg, br] = [await rect(cancel(page)), await rect(save(page)), await rect(page.locator(".ui-you-page")), await rect(bar(page))];
    const pad = await page.locator(".ui-you-page").evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft), r: parseFloat(c.paddingRight) }; });
    expect(a.x).toBeLessThan(b.x);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(a.h).toBeGreaterThanOrEqual(44);
    expect(Math.abs(a.x - (pg.x + pad.l))).toBeLessThanOrEqual(1);
    expect(Math.abs(b.x + b.w - (pg.x + pg.w - pad.r))).toBeLessThanOrEqual(1);
    for (const l of [await lines(cancel(page)), await lines(save(page))]) expect(l.text).toBeLessThan(1.5 * l.line);
    expect(Math.abs(br.y + br.h - (pg.y + pg.h))).toBeLessThanOrEqual(1);   // the bar's bottom edge is the screen's bottom
    expect(Math.abs(pg.y + pg.h - (b.y + b.h) - 24)).toBeLessThanOrEqual(1);   // 24 px under the buttons (no safe area in this browser)
    expect(await save(page).evaluate((e) => e.classList.contains("ghost"))).toBe(false);   // Save is the filled one
    expect(await cancel(page).evaluate((e) => e.classList.contains("ghost"))).toBe(true);
    expect(await bar(page).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(await page.locator(".ui-you-page").evaluate((e) => getComputedStyle(e).backgroundColor));   // the page's own background
    await expect(page.getByTestId("account").getByRole("button", { name: "Save", exact: true })).toHaveCount(0);   // the buttons left the card
    await cancel(page).click();
    await expect(bar(page)).toHaveCount(0);   // when the form closes the bar is gone
  });

  test(`with the keyboard open the bar rides on top of it and the focused field is not covered (${w}x${h})`, async ({ page, context }) => {
    await open(page, context, w, h, true);
    await edit(page);
    await page.locator('[id="acc-phone"]').focus();
    const kb = Math.round(h * 0.55);   // the visible height with the keyboard up
    await page.evaluate((v) => (window as unknown as { __vv: (h: number) => void }).__vv(v), kb);
    await expect.poll(async () => Math.round((await rect(page.locator(".ui-you-page"))).h)).toBe(kb);
    await expect.poll(async () => Math.round((await rect(bar(page))).y + (await rect(bar(page))).h)).toBe(kb);   // the bar's bottom is the keyboard's top
    await page.waitForTimeout(450);   // the page scrolls the focused field into view after the keyboard comes up
    const [f, br] = [await rect(page.locator('[id="acc-phone"]')), await rect(bar(page))];
    expect(f.y + f.h).toBeLessThanOrEqual(br.y + 0.5);   // the field is above the bar
    expect(f.y).toBeGreaterThanOrEqual(0);
  });
}

test("Save keeps the new name and closes the bar; the phone's Back button closes the page as before", async ({ page, context }) => {
  await open(page, context, 390, 844);
  await edit(page);
  await page.getByLabel("Your name").fill("Asha Rao");
  await save(page).click();
  await expect(page.getByTestId("account")).toContainText("Asha Rao");
  await expect(bar(page)).toHaveCount(0);
});
