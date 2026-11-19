// Story 1701 (owner, 20 Nov 2026, rule 29): on the Feedback sheet Close (outline) is left and Send (filled) is last, right, as a half and half pair in the shared .ui-row-pair.
// Measured in a real browser in the customer app (You > Send feedback) and in the console (the staff app's Feedback button). The words are unchanged.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const rect = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom }; });
const lines = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });
const settle = (page: Page) => page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))); });

const openers: Record<string, (page: Page) => Promise<void>> = {
  customer: async (page) => { await page.goto("/customer/"); await page.getByRole("button", { name: /^You: / }).click(); await page.getByRole("button", { name: /Send feedback/ }).click(); },
  console: async (page) => { await page.goto("/console/"); await page.getByRole("button", { name: "Feedback" }).click(); },
};

for (const [app, open] of Object.entries(openers)) for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S1 ${app}: Close is left, Send is right, equal halves on one line filling the sheet, bottom gap kept (${w}x${h})`, async ({ page, context }) => {
    await setup(context, page);
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const sheet = page.getByRole("dialog", { name: "Feedback" });
    await expect(sheet).toBeVisible();
    await settle(page);
    const close = sheet.getByRole("button", { name: "Close", exact: true }), send = sheet.getByRole("button", { name: "Send", exact: true });
    const [a, b, s] = [await rect(close), await rect(send), await rect(sheet)];
    const pad = await sheet.evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth), r: parseFloat(c.paddingRight) + parseFloat(c.borderRightWidth), b: parseFloat(c.paddingBottom) }; });
    expect(a.x).toBeLessThan(b.x);   // Close left, Send last
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
    expect(a.h).toBeGreaterThanOrEqual(44);
    expect(Math.abs(a.x - (s.x + pad.l))).toBeLessThanOrEqual(1);   // together they fill the sheet's content width
    expect(Math.abs(b.x + b.w - (s.x + s.w - pad.r))).toBeLessThanOrEqual(1);
    for (const l of [await lines(close), await lines(send)]) expect(l.text).toBeLessThan(1.5 * l.line);   // one line of text each
    expect(pad.b).toBeGreaterThanOrEqual(24);   // the bottom gap is max(24 px, safe area), as on the other sheets
    expect(Math.abs(s.bottom - b.bottom - pad.b)).toBeLessThanOrEqual(1);
  });
}
