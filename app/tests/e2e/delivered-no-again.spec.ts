// Story 1676 (owner, 20 Nov 2026): the "Order it again" block and the Order again bar are gone from the order page, however the page is opened.
// Order again lives on the History list (story 1738), which reads the veg marks on its own tap; opening the page reads none.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const dish = (id: string, name: string, price: number) => ({ id, name, price_paise: price, category: "Mains", veg: true, available: true, image_url: null, image_credit: null });
const LINES = [{ menu_item_id: "old-1", name: "Veg Thali", qty: 1, price_paise: 18000 }, { menu_item_id: "old-2", name: "Butter Roti", qty: 1, price_paise: 4000 }];
const past = () => ({ ...order("delivered", "2020-11-12T14:00:00Z", "2020-11-12T14:00:00Z"), items: LINES, total_paise: 22000 });

async function gone(page: Page) {
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order it again" })).toHaveCount(0);
  await expect(page.locator(".ui-again, .ui-again-dish, .ui-again-line")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Order again/ })).toHaveCount(0);
}

for (const size of SIZES) {
  test(`AC-1 at ${size.width} by ${size.height}: an order that turns delivered shows no Order it again block and no Order again button`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
    net.state.menu = [dish("d1", "Veg Thali", 18000)];
    await page.goto("/customer/");
    net.push("UPDATE", past());
    await gone(page);
    await expect(page.locator(".ui-bottom").getByRole("button", { name: "Back to menu" })).toBeVisible();
  });

  test(`AC-2 at ${size.width} by ${size.height}: the same order opened from History shows none of it, and the page reads no veg marks`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const net = await setup(context, page, [past()]);
    net.state.menu = [dish("d1", "Veg Thali", 18000)];
    const marks: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/rest/v1/menu_items") && r.url().includes("id=in.")) marks.push(r.url()); });
    await page.goto("/customer/");
    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: /Veg Thali/ }).click();
    await gone(page);
    await page.waitForTimeout(500);
    expect(marks).toHaveLength(0);
  });
}
