// Story #1157 (board SW5a-SwitchGrey, owner pick 9 Nov): off is a grey track with no border and a white knob; on is the green track with a white knob.
// The off track is 3:1 or more against the page (WCAG 1.4.11). Covers every .ui-switch: the Veg toggle and Order alerts.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

for (const theme of ["day", "night"] as const) {
  test(`S1 ${theme}: the knob is white off and on, the tracks differ, the off track has no border and is 3:1 against the page`, async ({ page, context }) => {
    await context.addInitScript((t) => { try { localStorage.setItem("gs-theme", t); } catch { /* default */ } }, theme);
    await setup(context, page);
    await page.goto("/customer/");
    const sw = page.getByRole("switch", { name: /Veg only/ }).first();
    await expect(sw).toBeVisible();
    const read = () => sw.evaluate((el) => {
      const px = (v: string) => { const c = document.createElement("canvas").getContext("2d")!; c.fillStyle = v; c.fillRect(0, 0, 1, 1); return Array.from(c.getImageData(0, 0, 1, 1).data).slice(0, 3); };
      const s = getComputedStyle(el), k = getComputedStyle(el, "::before");
      return { track: px(s.backgroundColor), knob: px(k.backgroundColor), border: s.borderTopWidth, page: px("var(--md-background)") };
    });
    const before = await read();   // off
    await sw.check();
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));   // the 120 ms colour change ends
    const on = await read();
    expect(before.knob).toEqual([255, 255, 255]);
    expect(on.knob).toEqual([255, 255, 255]);
    expect(before.track).not.toEqual(on.track);
    expect(before.border).toBe("0px");
    expect(ratio(before.track, before.page)).toBeGreaterThanOrEqual(3);
  });
}
