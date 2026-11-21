// Story 1675 (owner, 20 Nov 2026): the steps list goes on a delivered order only. Live orders at every stage keep it.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const list = (page: Page) => page.getByRole("list", { name: "Order progress" });
const dish = { id: "d1", name: "Veg Thali", price_paise: 18000, category: "Mains", veg: true, available: true, image_url: null, image_credit: null };
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];

for (const size of SIZES) {
  test(`AC-1 and AC-3 at ${size.width} by ${size.height}: a delivered order opened from History shows no steps list and does not scroll`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const net = await setup(context, page, [{ ...order("delivered", "2020-11-12T14:00:00Z", "2020-11-12T14:00:00Z"), items: [{ menu_item_id: "d1", name: "Veg Thali", qty: 1, price_paise: 18000 }], total_paise: 18000 }]);
    net.state.menu = [dish];
    await page.goto("/customer/");
    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: /Veg Thali/ }).click();
    await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
    await expect(list(page)).toHaveCount(0);
    for (const t of ["Ready, rider picks up", "On the way"]) await expect(page.getByText(t, { exact: true })).toHaveCount(0);
    if (size.height === 844) expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && [...document.querySelectorAll(".ui-scroll")].every((e) => e.scrollHeight <= e.clientHeight + 1))).toBe(true);   // AC-3: 390 by 844 only
  });
}

test("AC-1 a live order that turns delivered loses the steps list", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  await page.goto("/customer/");
  await expect(list(page)).toBeVisible();
  net.push("UPDATE", order("delivered", "2020-01-01T10:09:00Z"));
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  await expect(list(page)).toHaveCount(0);
});

for (const status of ["placed", "accepted", "preparing", "ready", "out_for_delivery"]) {
  test(`AC-2 ${status}: the steps list still shows`, async ({ page, context }) => {
    await setup(context, page, [order(status, "2020-01-01T10:05:00Z")]);
    await page.goto("/customer/");
    await expect(list(page).getByRole("listitem")).toHaveCount(3);
  });
}
