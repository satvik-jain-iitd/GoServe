// Story #1160 (board L4d-ClosedGreyMenu, owner pick 9 Nov): while the kitchen is closed the menu looks closed. Dish photos are grayscale at 0.75, names and prices are muted
// (4.5:1 or more), there is no Add at all (owner, 9 Nov: a closed kitchen shows none), and the header, the Closed card, View bill and the tabs keep full colour. Open again: all back, no reload.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

async function open(page: Page, context: Parameters<typeof setup>[0], closed: boolean) {
  const net = await setup(context, page);
  (net.state.kitchens[0] as { open?: boolean }).open = !closed;
  await context.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  net.state.menu = net.state.menu.map((d: any) => ({ ...d, image_url: "https://img.test/" + d.id + ".png" }));
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: closed ? "Butter Chicken details" : "Add Butter Chicken" }).first()).toBeVisible();
  return net;
}
const filters = (page: Page, sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => getComputedStyle(e).filter));

test("S1 closed: every dish photo is grayscale, and the Closed card has no filter", async ({ page, context }) => {
  await open(page, context, true);
  const f = await filters(page, ".ui-tile img, .ui-hero img");
  expect(f.length).toBeGreaterThan(0);
  for (const x of f) expect(x).toContain("grayscale(1)");
  expect(await filters(page, ".ui-closed, .ui-closed *, .ui-top, .ui-top *")).toEqual(expect.arrayContaining([]));
  for (const x of await filters(page, ".ui-closed")) expect(x).toBe("none");
});

test("S2 closed: there is no Add button anywhere, and the dish sheet keeps only Close", async ({ page, context }) => {
  await open(page, context, true);
  await expect(page.getByRole("button", { name: /^Add / })).toHaveCount(0);   // hero, rows and steppers
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Butter Chicken details" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Butter Chicken" });
  await expect(sheet.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Add to bill/ })).toHaveCount(0);
  await expect(sheet.getByRole("status", { name: /Quantity/ })).toHaveCount(0);
});

test("S5 the kitchen opens again: Add and the photos come back in colour, with no reload", async ({ page, context }) => {
  const net = await setup(context, page);
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  await context.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  net.state.menu = net.state.menu.map((d: any) => ({ ...d, image_url: "https://img.test/" + d.id + ".png" }));
  await page.goto("/customer/");
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add / })).toHaveCount(0);
  (net.state.kitchens[0] as { open?: boolean }).open = true;
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible({ timeout: 5000 });
  for (const x of await filters(page, ".ui-tile img, .ui-hero img")) expect(x).toBe("none");
});

test("S3 closed: dish names and prices are muted but still 4.5:1 on the page", async ({ page, context }) => {
  await open(page, context, true);
  const c = await page.locator(".ui-tile .ui-price").first().evaluate((el) => {
    const px = (v: string) => { const t = document.createElement("i"); t.style.color = v; document.body.append(t); const c = getComputedStyle(t).color; t.remove(); return (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number); };
    return { text: px(getComputedStyle(el).color), muted: px("var(--gs-text-muted)"), page: px("var(--md-background)") };
  });
  expect(c.text).toEqual(c.muted);
  expect(ratio(c.text, c.page)).toBeGreaterThanOrEqual(4.5);
});

test("S4 open: no photo has a filter and Add is there", async ({ page, context }) => {
  await open(page, context, false);
  for (const x of await filters(page, ".ui-tile img, .ui-hero img")) expect(x).toBe("none");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeEnabled();
});
