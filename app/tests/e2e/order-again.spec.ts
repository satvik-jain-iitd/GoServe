// Story #977, board H1-History; story 1589 moved the button into the opened delivered order (frame history-1): it fills the cart at today's prices and opens the Bill.
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
  await page.getByRole("button", { name: /Veg Thali/ }).click();   // story 1589: the button is in the opened order
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  return net;
};

test("S1 Order again opens the Bill with the same dishes at today's prices, with no note carried over", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500)], [past(THALI_ROTI)]);
  await page.getByRole("button", { name: /Order again ›/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Veg Thali")).toBeVisible();
  await expect(page.getByText("Roti")).toBeVisible();
  await expect(page.getByText("₹230").first()).toBeVisible();   // 180 + 2 x 25 at today's prices, not the old 50
  await expect(page.getByLabel(/Note for the kitchen/)).toHaveValue("");
});

test("S2 a sold-out dish is left out: its row says sold out today, the Bill has the rest", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500, { available: false })], [past(THALI_ROTI)]);
  await expect(page.locator(".ui-again-dish").nth(1)).toContainText("sold out today");
  await page.getByRole("button", { name: /Order again ›/ }).click();
  await expect(page.getByText("Veg Thali")).toBeVisible();
  await expect(page.getByText("Roti ×")).toHaveCount(0);
});

test("S3 a closed kitchen adds nothing: the button is greyed and the line says so", async ({ page, context }) => {
  await history(page, context, [dish("d1", "Veg Thali", 18000), dish("d2", "Roti", 2500)], [past(THALI_ROTI)], (s) => { s.kitchens = [{ ...s.kitchens[0], open: false }]; });
  await expect(page.getByRole("button", { name: /Order again ›/ })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: /closed now/ })).toBeVisible();
});

test("S4 only a delivered order has the block; the head says History", async ({ page, context }) => {
  const net = await setup(context, page, [order("cancelled")]);
  net.state.menu = [dish("d1", "Veg Thali", 18000)];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Order again/ })).toHaveCount(0);
});
