// Story 1695 (owner, 20 Nov 2026): the new-order sheet answers with a half and half pair, Decline left (red outline), Accept filled right, at the bottom of the sheet.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const LONG = "Please make it mild, no onion, no garlic, no peanuts at all because of a bad allergy, and pack the gravy apart from the rice so nothing gets soggy on the way.";
const rect = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const lines = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });

async function open(page: Page, context: Parameters<typeof setup>[0], w: number, h: number, note?: string) {
  const net = await setup(context, page, [{ ...order("placed"), ...(note ? { instructions: note } : {}) }]);
  net.state.kitchen = "k-1";
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet).toBeVisible();
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))); });
  return { sheet, net };
}

for (const [w, h] of [[360, 640], [390, 844], [412, 915]]) {
  test(`Decline and Accept are a half and half pair, Decline left, one line each, at the bottom of the sheet (${w}x${h})`, async ({ page, context }) => {
    const { sheet } = await open(page, context, w, h);
    const decline = sheet.getByRole("button", { name: "Decline 0f0f0f0f" }), accept = sheet.getByRole("button", { name: "Accept 0f0f0f0f" });
    await expect(decline).toHaveText("Decline");
    await expect(accept).toHaveText("Accept");
    await expect(sheet.locator(".ui-row-pair")).toHaveCount(1);
    const [a, b, s] = [await rect(decline), await rect(accept), await rect(sheet)];
    const pad = await sheet.evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth), r: parseFloat(c.paddingRight) + parseFloat(c.borderRightWidth), b: parseFloat(c.paddingBottom) }; });
    expect(a.x).toBeLessThan(b.x);   // Decline left, Accept right
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.x - (s.x + pad.l))).toBeLessThanOrEqual(1);   // together they fill the sheet's content width
    expect(Math.abs(b.x + b.w - (s.x + s.w - pad.r))).toBeLessThanOrEqual(1);
    for (const l of [await lines(decline), await lines(accept)]) expect(l.text).toBeLessThan(1.5 * l.line);   // one line each
    expect(a.h).toBeGreaterThanOrEqual(44);   // a gloved thumb
    expect(h - (b.y + b.h)).toBeGreaterThanOrEqual(24);   // the bottom gap is 24 px or more
    expect(pad.b).toBeGreaterThanOrEqual(24);
    await expect(decline).toHaveClass(/ghost/);   // the red outline stays
    expect(await decline.evaluate((e) => getComputedStyle(e).borderColor)).toBe(await decline.evaluate((e) => getComputedStyle(e).color));
  });
}

test("a long note from the customer keeps both buttons in view (360x640)", async ({ page, context }) => {
  const { sheet } = await open(page, context, 360, 640, LONG);
  for (const n of ["Decline 0f0f0f0f", "Accept 0f0f0f0f"]) { await expect(sheet.getByRole("button", { name: n })).toBeInViewport({ ratio: 1 }); }
});

test("a tap on Decline still opens the reason sheet, and Accept still accepts", async ({ page, context }) => {
  const { sheet, net } = await open(page, context, 390, 844);
  await sheet.getByRole("button", { name: "Decline 0f0f0f0f" }).click();
  await expect(page.getByRole("dialog", { name: "Decline order 0f0f0f0f" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("dialog", { name: "Order 0f0f0f0f" }).getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect.poll(() => net.calls.status.length).toBe(1);
});

// Story 1703 (owner, 20 Nov 2026): the reason sheet has no ready-made reasons; red Decline left, Back right, one half and half pair.
for (const [w, h] of [[360, 640], [390, 844], [412, 915]]) {
  test(`reason sheet: no ready-made reason, Decline (red, asleep) left and Back right as a pair, then it wakes at 20 characters (${w}x${h})`, async ({ page, context }) => {
    const { sheet, net } = await open(page, context, w, h);
    await sheet.getByRole("button", { name: "Decline 0f0f0f0f" }).click();
    const d = page.getByRole("dialog", { name: "Decline order 0f0f0f0f" });
    await expect(d).toBeVisible();
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((x) => x.effect?.getComputedTiming().iterations !== Infinity).map((x) => x.finished.catch(() => undefined))); });
    await expect(d.locator(".ui-sheet-chips, .ui-chip")).toHaveCount(0);
    await expect(d.getByRole("button")).toHaveCount(2);   // only Decline and Back
    const decline = d.getByRole("button", { name: "Decline", exact: true }), back = d.getByRole("button", { name: "Back", exact: true });
    await expect(d.locator(".ui-row-pair")).toHaveCount(1);
    await expect(decline).toHaveAttribute("aria-disabled", "true");
    const [a, b, s] = [await rect(decline), await rect(back), await rect(d)];
    const pad = await d.evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth), r: parseFloat(c.paddingRight) + parseFloat(c.borderRightWidth) }; });
    expect(a.x).toBeLessThan(b.x);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.x - (s.x + pad.l))).toBeLessThanOrEqual(1);
    expect(Math.abs(b.x + b.w - (s.x + s.w - pad.r))).toBeLessThanOrEqual(1);
    for (const l of [await lines(decline), await lines(back)]) expect(l.text).toBeLessThan(1.5 * l.line);
    expect(a.h).toBeGreaterThanOrEqual(44);
    expect(h - (b.y + b.h)).toBeGreaterThanOrEqual(24);
    await d.getByLabel("Reason").fill("We are too busy to take this one.");
    await expect(decline).not.toHaveAttribute("aria-disabled", "true");
    await decline.click();
    await expect.poll(() => net.calls.status.length).toBe(1);
    expect(net.calls.status[0].body).toMatchObject({ action: "cancel", reason: "We are too busy to take this one." });
  });
}
