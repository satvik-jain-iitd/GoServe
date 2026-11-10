// Story #1275 (board K4-NewOrderBar): a new order shows as a filled full-width bar under the header on Cooking and Today, so a cook 1 to 2 metres away sees it on any tab.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const NOW = "2026-11-10T10:07:00Z";
const placed = (n: number, at = "2026-11-10T10:00:00Z") => ({ ...order("placed", at, at), id: `0${n}0${n}0${n}0${n}-1111-4222-8333-444444444444` });
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const bar = (page: Page) => page.getByRole("button", { name: /new orders?\b.*Oldest/ });
const open = async (page: Page, context: Parameters<typeof setup>[0], orders: object[], theme = "day") => {
  await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
  await page.clock.setFixedTime(new Date(NOW));
  const net = await setup(context, page, orders);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "New" })).toBeVisible();
  return net;
};

test("S1 two new orders, on Cooking: the bar reads 2 new orders and Oldest 7 min, and a tap opens New", async ({ page, context }) => {
  await open(page, context, [placed(1), placed(2, "2026-11-10T10:03:00Z")]);
  await tab(page, "Cooking").click();
  await expect(page.getByRole("heading", { name: "Cooking" })).toBeVisible();
  await expect(bar(page)).toContainText("2 new orders");
  await expect(bar(page)).toContainText("Oldest 7 min");
  const box = (await bar(page).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(64);
  expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);   // full width
  await bar(page).click();
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();
});

test("S2 one new order reads 1 new order, on Today as well", async ({ page, context }) => {
  await open(page, context, [placed(1)]);
  await tab(page, "Today").click();
  await expect(bar(page)).toContainText("1 new order");
  await expect(bar(page)).not.toContainText("1 new orders");
  await expect(page.getByLabel("1 new")).toBeVisible();   // the tab badge stays
});

test("S3 a new order arrives while the cook is on Today: the bar shows without a reload; accepting the last one removes it", async ({ page, context }) => {
  const net = await open(page, context, []);
  await tab(page, "Today").click();
  await expect(bar(page)).toHaveCount(0);   // no waiting order, no bar
  net.push("INSERT", placed(1));
  await expect(bar(page)).toContainText("1 new order", { timeout: 5000 });
  await bar(page).click();
  await page.getByRole("button", { name: /^Open ticket / }).click();
  await page.getByRole("button", { name: /^Accept / }).click();
  await tab(page, "Cooking").click();
  await expect(page.getByRole("heading", { name: "Cooking" })).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
});

for (const theme of ["day", "night"]) {
  test(`S4 ${theme}: the bar text passes 4.5:1 on its fill`, async ({ page, context }) => {
    await open(page, context, [placed(1)], theme);
    await tab(page, "Cooking").click();
    await expect(bar(page)).toBeVisible();
    const ratio = await bar(page).evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const s = getComputedStyle(el);
      const a = lum(rgb(s.color)), b = lum(rgb(s.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
