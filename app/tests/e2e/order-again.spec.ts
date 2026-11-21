// Story #977, board H1-History; story 1676 took the button off the order page; S1 to S3 (the tap fills the cart at today's prices and opens the Bill, a sold-out dish, a closed kitchen) move to story 1738, which puts the button on the History list.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const dish = (id: string, name: string, price: number, over: object = {}) => ({ id, name, price_paise: price, category: "Mains", veg: true, available: true, image_url: null, image_credit: null, ...over });
const past = (lines: { id: string; name: string; qty: number }[]) => ({ ...order("delivered"), items: lines.map((l) => ({ menu_item_id: l.id, name: l.name, qty: l.qty, price_paise: 1000 })), total_paise: 5000, instructions: "no onion" });
const THALI_ROTI = [{ id: "d1", name: "Veg Thali", qty: 1 }, { id: "d2", name: "Roti", qty: 2 }];

test("S4 a cancelled order in History has no Order again; the head says History", async ({ page, context }) => {
  const net = await setup(context, page, [order("cancelled")]);
  net.state.menu = [dish("d1", "Veg Thali", 18000)];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Order again/ })).toHaveCount(0);
});
