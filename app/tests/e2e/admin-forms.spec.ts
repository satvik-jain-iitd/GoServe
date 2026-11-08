// Story #923: the admin's Add kitchen and Add dish forms do not scroll sideways, the text fields share one width and height, and the veg switch keeps 52x32.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

type Box = { sel: string; w: number; h: number; right: number };
// Everything wider than the visible page, with the element named (a class, an id or its text) so a failure says which one overflows.
const measure = (page: Page, root: string) => page.evaluate((r) => {
  const vw = document.documentElement.clientWidth;
  const name = (e: Element) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const over = Array.from(document.querySelectorAll(r + " *")).filter((e) => !e.closest(".leaflet-container") && e.getBoundingClientRect().right > vw + 0.5).map((e) => name(e));
  const scrolls = [document.documentElement, ...Array.from(document.querySelectorAll(".ui-scroll, .ui-app, main"))].filter((e) => e.scrollWidth > e.clientWidth + 0.5).map(name);
  const fields: Box[] = Array.from(document.querySelectorAll(r + " .ui-field input:not([type=file]):not([type=checkbox]):not([type=time])")).map((e) => { const b = e.getBoundingClientRect(); return { sel: name(e), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) }; });
  const sw = document.querySelector(r + " .ui-switch"); const sb = sw?.getBoundingClientRect();
  return { vw, over, scrolls, fields, sw: sb ? { w: Math.round(sb.width), h: Math.round(sb.height) } : null };
}, root);

async function openKitchenForm(page: Page, context: any) {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /Add a kitchen|\+ Add kitchen/ }).first().click().catch(async () => { await page.getByRole("button", { name: /kitchen/i }).first().click(); });
}
async function openDishForm(page: Page, context: any) {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await expect(page.getByLabel("Dish name")).toBeVisible();
}

for (const width of [360, 412, 768]) {
  test(`S1 Add dish at ${width} px: no sideways scroll, one width and height for the text fields, the switch is 52x32`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 915 });
    await openDishForm(page, context);
    const m = await measure(page, "section");
    expect(m.over, `elements past the right edge at ${width}: ${m.over.join(" | ")}`).toEqual([]);
    expect(m.scrolls, "something scrolls sideways").toEqual([]);
    expect(new Set(m.fields.map((f) => f.w)).size, `field widths ${JSON.stringify(m.fields)}`).toBe(1);
    expect(new Set(m.fields.map((f) => f.h)).size, `field heights ${JSON.stringify(m.fields)}`).toBe(1);
    expect(m.sw, "the veg switch").toEqual({ w: 52, h: 32 });
  });

  test(`S2 Add kitchen at ${width} px: no sideways scroll, one width and height for the text fields`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 915 });
    await openKitchenForm(page, context);
    await expect(page.getByLabel("Kitchen name")).toBeVisible();
    const m = await measure(page, ".ui-form");
    expect(m.over, `elements past the right edge at ${width}: ${m.over.join(" | ")}`).toEqual([]);
    expect(m.scrolls, "something scrolls sideways").toEqual([]);
    expect(new Set(m.fields.map((f) => f.w)).size, `field widths ${JSON.stringify(m.fields)}`).toBe(1);
    expect(new Set(m.fields.map((f) => f.h)).size, `field heights ${JSON.stringify(m.fields)}`).toBe(1);
  });
}

test("S3 Add kitchen: the Location row keeps 12 px of air above and below it", async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await openKitchenForm(page, context);
  const gaps = await page.evaluate(() => {
    const row = document.querySelector(".ui-locrow")!.getBoundingClientRect();
    const pins = document.querySelector("#k-pins")!.getBoundingClientRect();
    const open = document.querySelector("#k-open")!.getBoundingClientRect();
    return [Math.round(row.top - pins.bottom), Math.round(open.top - row.bottom)];
  });
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(12);
});

test("S4 the bill's 'How you pay' radio buttons keep their small round size (the form rule must not stretch them)", async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  const widths = await page.locator("input[type=radio]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(widths.length).toBeGreaterThan(0);
  for (const w of widths) expect(w, `radio widths ${widths}`).toBeLessThanOrEqual(32);
});
