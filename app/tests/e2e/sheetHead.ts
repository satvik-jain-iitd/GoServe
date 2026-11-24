// Story 1565: the head of a sheet. Shared by the Chromium and the WebKit spec. The cancel sheet's title sits on one line and the sheet has no close control in its head (owner's pick B);
// "Keep order", Back, Escape and a tap outside close it. No close control in the head of any sheet is stretched. Measured in a real browser (rule 19).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, setup, openSetting } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const KITCHEN = { id: "k-1", name: "Sample Kitchen", address: "Sample Road", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };

const cancelSheet = async (page: Page, context: BrowserContext) => {
  await setup(context, page, [order("placed", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  const sheet = page.getByRole("dialog", { name: "Cancel this order?" });
  await expect(sheet).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return sheet;
};
const admin = async (page: Page, context: BrowserContext, tab: string) => {
  const net = await setup(context, page); net.state.admin = true; net.state.kitchens = [KITCHEN];
  await page.goto("/admin/");
  if (tab === "Simulator") await openSetting(page, "Simulator"); else await page.getByRole("button", { name: tab, exact: true }).click();
  if (tab === "City") await page.getByRole("button", { name: /^Open kitchen Sample Kitchen/ }).click();
};

export function sheetHead() {
  for (const size of SIZES) {
    const at = `${size.width}x${size.height}`;
    test(`${at}: the cancel sheet's title is on one line and nothing is wider than the sheet`, async ({ page, context }) => {
      await page.setViewportSize(size);
      const sheet = await cancelSheet(page, context);
      const m = await sheet.evaluate((el) => {
        const h2 = el.querySelector("h2")!, box = el.getBoundingClientRect();
        const wide = [...el.querySelectorAll<HTMLElement>("*")].filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5); })
          .map((c) => `${c.tagName.toLowerCase()}.${String(c.className).split(" ").join(".")} ends at ${Math.round(c.getBoundingClientRect().right)} px, the sheet at ${Math.round(box.right)} px`);
        return { lines: h2.getBoundingClientRect().height / parseFloat(getComputedStyle(h2).lineHeight), wide, side: el.scrollWidth - el.clientWidth, down: el.scrollHeight - el.clientHeight, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(m.lines, `the title is ${m.lines.toFixed(1)} lines high`).toBeLessThan(1.5);
      expect(m.wide, "parts of the sheet that leave it").toEqual([]);
      expect(m.side, "the sheet scrolls sideways").toBeLessThanOrEqual(0);
      expect(m.page, "the page scrolls sideways").toBeLessThanOrEqual(0);
      expect(m.down, "the sheet needs a scroll").toBeLessThanOrEqual(0);
    });
  }

  test("the cancel sheet has no close control in its head; Keep order has the focus", async ({ page, context }) => {
    const sheet = await cancelSheet(page, context);
    await expect(sheet.locator(".ui-sheet-head button")).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Close" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Keep order" })).toBeFocused();
  });

  // [the sheet, how to open it, the dialog's name]: every sheet whose head holds a close control
  const HEADS: [string, (page: Page, context: BrowserContext) => Promise<unknown>, string | RegExp][] = [
    ["Remove a kitchen (admin)", async (p, c) => { await admin(p, c, "City"); await p.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click(); }, /^Remove /],
    ["Edit a kitchen (admin)", async (p, c) => { await admin(p, c, "City"); await p.getByRole("button", { name: "Edit details" }).click(); }, "Edit Sample Kitchen"],
    ["Edit a dish (admin)", async (p, c) => { await admin(p, c, "City"); await p.getByRole("button", { name: /^Edit Butter Chicken/ }).click(); }, "Edit Butter Chicken"],
    ["Clear everything? (admin)", async (p, c) => { await admin(p, c, "Simulator"); await p.getByRole("button", { name: "Clear everything" }).click(); }, "Clear everything?"],
    ["the demo sheet (styleguide, the shared Sheet)", async (p) => { await p.goto("/styleguide/"); await p.getByRole("button", { name: "Open sheet" }).click(); }, "Demo sheet"],
  ];
  for (const [name, open, dialog] of HEADS) test(`360 px: the close control in the head of ${name} is not stretched and stays in the sheet`, async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await open(page, context);
    const sheet = page.getByRole("dialog", { name: dialog });
    await expect(sheet).toBeVisible();
    const [b, s] = await Promise.all([sheet.getByRole("button", { name: "Close" }).first().boundingBox(), sheet.boundingBox()]);
    expect(b!.width, `the close control is ${b!.width} px wide`).toBeLessThanOrEqual(88);
    expect(b!.x + b!.width, "the close control ends inside the sheet").toBeLessThanOrEqual(s!.x + s!.width + 0.5);
  });

  // The rule itself, not one sheet: an icon button dropped into any sheet keeps its own size.
  test("any icon button in a sheet keeps the size of an icon button", async ({ page }) => {
    await page.goto("/styleguide/");
    await page.getByRole("button", { name: "Open sheet" }).click();
    const w = await page.getByRole("dialog", { name: "Demo sheet" }).evaluate((el) => {
      const head = document.createElement("div"); head.className = "ui-sheet-head"; head.innerHTML = '<h2>A long enough title</h2><button type="button" class="ui-btn ghost icon">x</button>';
      el.prepend(head);
      return head.querySelector("button")!.getBoundingClientRect().width;
    });
    expect(w, `an icon button in a sheet head is ${w} px wide`).toBeLessThanOrEqual(48);
  });
}
