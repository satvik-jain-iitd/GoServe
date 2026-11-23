// Story 1749: Close in the head of the shared Sheet is a plain underlined link in the brand colour, not a button. Measured in a real browser (rule 19).
// The foot pairs (dish "Close | Add", feedback "Close | Send") stay buttons; they are not the shared Sheet head.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const open = async (page: Page, size: { width: number; height: number }, theme: "day" | "night") => {
  await page.setViewportSize(size);
  await page.goto("/styleguide/");
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  await page.getByRole("button", { name: "Open sheet" }).click();
  await expect(page.getByRole("dialog", { name: "Demo sheet" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};
const lum = (c: string) => { const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => { const s = +v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const theme of ["day", "night"] as const) {
  test(`${theme}: head Close is an underlined brand-colour link, 44x44, contrast 4.5:1`, async ({ page, context }) => {
    await setup(context, page);
    await open(page, SIZES[0], theme);
    const m = await page.getByRole("dialog", { name: "Demo sheet" }).evaluate((sheet) => {
      const b = sheet.querySelector(".ui-sheet-head button")!, cs = getComputedStyle(b), r = b.getBoundingClientRect();
      return { border: cs.borderTopWidth, bg: cs.backgroundColor, deco: cs.textDecorationLine, color: cs.color, primary: getComputedStyle(document.documentElement).getPropertyValue("--md-primary"), w: r.width, h: r.height, sheetBg: getComputedStyle(sheet).backgroundColor };
    });
    expect(m.border).toBe("0px");
    expect(m.bg).toMatch(/, 0\)$/);   // fully transparent
    expect(m.deco).toContain("underline");
    expect(m.w).toBeGreaterThanOrEqual(44);
    expect(m.h).toBeGreaterThanOrEqual(44);
    expect(ratio(m.color, m.sheetBg), `${m.color} on ${m.sheetBg}`).toBeGreaterThanOrEqual(4.5);
  });
}

for (const size of SIZES) {
  test(`${size.width}x${size.height}: the title and the sheet top stay where they were; a tap and Back close it`, async ({ page, context }) => {
    await setup(context, page);
    await open(page, size, "day");
    const sheet = page.getByRole("dialog", { name: "Demo sheet" });
    const m = await sheet.evaluate((el) => ({ top: el.getBoundingClientRect().top, h2: el.querySelector("h2")!.getBoundingClientRect().top - el.getBoundingClientRect().top, h2h: el.querySelector("h2")!.getBoundingClientRect().height }));
    // measured on the button version (dev c8941016): title box offset 25 px from the sheet top (within 1 px), head 44 px high.
    expect(Math.abs(m.h2 - (44 - m.h2h) / 2 - 25), "title box offset in the head").toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole("button", { name: "Open sheet" }).click();
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
  });
}
