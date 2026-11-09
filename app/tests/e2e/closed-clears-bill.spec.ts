// Story #1162 (owner, 9 Nov, QA screen 19): the kitchen closes while a customer has items but has NOT placed the order. The app goes to the closed menu at once, the bill is cleared, and a status line
// says so. A placed order is never moved. The closed copy no longer says "Your bill is kept".
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const DISHES = [
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, available: true },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, available: true },
];
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const quote = { ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 25000, fees: { delivery_paise: 4000, packaging_paise: 0, total_paise: 4000 }, discount_paise: 0, coupon: null, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 29000, saved_paise: 0, offers: [] };
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 29000, address: "x", items: [], bill: {}, created_at: "2026-11-06T10:00:00Z" } };
const add = (page: Page, name: string) => page.getByRole("button", { name: `Add ${name}` });
const close = (net: Awaited<ReturnType<typeof setup>>) => { Object.assign(net.state.kitchens[0], { open: false, opens_at: "18:00:00" }); net.push("UPDATE", net.state.kitchens[0], "kitchens"); };

test("S1 on the bill, the kitchen closes: the app lands on the closed menu, the bill is cleared, and the status line says so", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await add(page, "Butter Chicken").click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  close(net);
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "The kitchen just closed. Your bill was cleared. Order again from 6:00 pm." })).toBeVisible();
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  await expect(page.getByText("Your bill is kept")).toHaveCount(0);
  // The kitchen opens again: the bill is empty, not brought back.
  Object.assign(net.state.kitchens[0], { open: true, opens_at: "00:00:00", closes_at: "23:59:00" });
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(add(page, "Butter Chicken")).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
});

test("S2 on the menu with items and the dish sheet open, the kitchen closes: the sheet closes and the bill is cleared", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await add(page, "Butter Chicken").click();
  await page.getByRole("button", { name: "Dal Makhani details" }).click();
  await expect(page.getByRole("dialog", { name: "Dal Makhani" })).toBeVisible();
  close(net);
  await expect(page.getByRole("dialog", { name: "Dal Makhani" })).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("status").filter({ hasText: "The kitchen just closed. Your bill was cleared." })).toBeVisible();
});

test("S3 the status line goes away on the next tap", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await add(page, "Butter Chicken").click();
  close(net);
  const line = page.getByRole("status").filter({ hasText: "The kitchen just closed" });
  await expect(line).toBeVisible({ timeout: 5000 });
  await page.mouse.click(200, 300);
  await expect(line).toHaveCount(0);
});

test("S4 an empty bill: closing shows no cleared line (nothing was cleared)", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await expect(add(page, "Butter Chicken")).toBeVisible();
  close(net);
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Your bill was cleared")).toHaveCount(0);
});

test("S5 a placed order is never moved: the tracker stays when the kitchen closes", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await context.route("https://test.supabase.co/functions/v1/quote", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote) }));
  await context.route("https://test.supabase.co/functions/v1/orders", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) }));
  await page.goto("/customer/");
  await add(page, "Butter Chicken").click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park, Delhi");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  close(net);
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByText("Your bill was cleared")).toHaveCount(0);
});
