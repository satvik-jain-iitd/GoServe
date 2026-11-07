// Story #977, board H1-History: a delivered order has Order again under its tag; it fills the cart at today's prices and opens the Bill.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const dish = (id: string, name: string, price: number, over: object = {}) => ({ id, name, price_paise: price, category: "Mains", veg: true, available: true, image_url: null, image_credit: null, ...over });
const past = (lines: { id: string; name: string; qty: number }[]) => ({ ...order("delivered"), items: lines.map((l) => ({ menu_item_id: l.id, name: l.name, qty: l.qty, price_paise: 1000 })), total_paise: 5000, instructions: "no onion" });
const THALI_ROTI = [{ id: "d1", name: "Veg Thali", qty: 1 }, { id: "d2", name: "Roti", qty: 2 }];

const history = async (page: Page, context: Parameters<typeof setup>[0], menu: object[], orders: object[], tune?: (s: any) => void) => {
  const net = await setup(context, page, orders);
  net.state.menu = menu;
  tune?.(net.state);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  return net;
};

test("S1 Order again opens the Bill with the same dishes at today's prices, with no note carried over", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500)], [past(THALI_ROTI)]);
  await page.getByRole("button", { name: /^Order again, No\./ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Veg Thali")).toBeVisible();
  await expect(page.getByText("Roti")).toBeVisible();
  await expect(page.getByText("₹230").first()).toBeVisible();   // 180 + 2 x 25 at today's prices, not the old 50
  await expect(page.getByLabel(/Anything the kitchen should know/)).toHaveValue("");
});

test("S2 a sold-out dish is left out and the line names it", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500, { available: false })], [past(THALI_ROTI)]);
  await page.getByRole("button", { name: /^Order again, No\./ }).click();
  await expect(page.getByText("Veg Thali")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Roti is not on the menu today." })).toBeVisible();
  await expect(page.getByText("Roti ×")).toHaveCount(0);
});

test("S3 a closed kitchen adds nothing and the line says so", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500)], [past(THALI_ROTI)], (s) => { s.kitchens = [{ ...s.kitchens[0], open: false }]; });
  await page.getByRole("button", { name: /^Order again, No\./ }).click();
  await expect(page.getByRole("status").filter({ hasText: /closed now/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
});

test("S4 only a delivered slip has the button; the head says History", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500)], [order("cancelled")]);
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Order again/ })).toHaveCount(0);
});
