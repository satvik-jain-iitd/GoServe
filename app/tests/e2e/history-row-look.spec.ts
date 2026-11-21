// Story 1738, reviewer's findings (frame j6again-frames, right side): a delivered row has the Order again button and no chevron, one line of title cut with dots, one line of time and price;
// every row has the same height; the button is 112 x 44. And a slow marks read never pulls the customer back to the Bill after he left History.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const dish = (id: string, name: string, price: number) => ({ id, name, price_paise: price, category: "Mains", veg: true, available: true, image_url: null, image_credit: null });
const uid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const past = (n: number, status: string, created: string, lines: [string, string, number][], over: object = {}) => ({
  ...order(status, created, created), id: uid(n), kitchen_id: "k-1", items: lines.map(([id, name, qty]) => ({ menu_item_id: id, name, qty, price_paise: 1000 })), total_paise: 22000, ...over,
});
const FIVE: [string, string, number][] = [["d1", "Butter Roti with extra butter", 4], ["d2", "Veg Thali", 1], ["d3", "Dal Makhani special", 2], ["d4", "Paneer Tikka Masala", 1], ["d5", "Jeera Rice", 1]];
const ONE: [string, string, number][] = [["d1", "Veg Thali", 1]];
const ROWS = [past(1, "delivered", "2020-11-14T14:00:00Z", FIVE), past(2, "delivered", "2020-11-13T14:00:00Z", ONE), past(3, "cancelled", "2020-11-12T14:00:00Z", ONE)];

async function list(page: Page, context: Parameters<typeof setup>[0], rows: object[] = ROWS) {
  const net = await setup(context, page, rows);
  net.state.menu = [dish("d1", "Veg Thali", 18000)];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".ui-order-row").first()).toBeVisible();
  return net;
}

for (const size of SIZES) {
  test(`at ${size.width} by ${size.height}: a 5-dish row, a 1-dish row and a cancelled row have one height; the button is 112 by 44`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await list(page, context);
    const h = await page.locator(".ui-order-row").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(h).toHaveLength(3);
    expect(Math.abs(h[0] - h[1])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(h[1] - h[2])).toBeLessThanOrEqual(0.5);
    const b = (await page.getByRole("button", { name: "Order again", exact: true }).first().boundingBox())!;
    expect([Math.round(b.width), Math.round(b.height)]).toEqual([112, 44]);
  });

  test(`at ${size.width} by ${size.height}: the title and the time line are one line each, the long title ends with dots`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await list(page, context);
    const m = await page.locator(".ui-order-row").first().evaluate((row) => {
      const t = row.querySelector(".ui-order-items") as HTMLElement, s = row.querySelector(".ui-order-sub") as HTMLElement;
      const one = (e: HTMLElement) => e.getBoundingClientRect().height < 1.6 * parseFloat(getComputedStyle(e).fontSize) * 1.2 + 1;
      return { titleOne: one(t), subOne: one(s), cut: t.scrollWidth > t.clientWidth, ellipsis: getComputedStyle(t).textOverflow };
    });
    expect(m).toEqual({ titleOne: true, subOne: true, cut: true, ellipsis: "ellipsis" });
  });
}

test("a delivered row has no chevron and still opens the order; a cancelled row keeps its chevron", async ({ page, context }) => {
  await list(page, context);
  const rows = page.locator(".ui-order-row");
  await expect(rows.nth(0).locator(".ui-order-open svg")).toHaveCount(0);
  await expect(rows.nth(1).locator(".ui-order-open svg")).toHaveCount(0);
  await expect(rows.nth(2).locator(".ui-order-open svg")).toHaveCount(1);
  await rows.nth(1).locator(".ui-order-open").click();
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
});

test("a slow marks read: the customer taps Order again, then Delivery; when the marks answer he stays on the menu and the bag is as it was", async ({ page, context }) => {
  await list(page, context, [past(1, "delivered", "2020-11-14T14:00:00Z", [["old-1", "Veg Thali", 1]], { kitchen_id: "k-2" })]);
  let answered = false;
  await context.route((u) => u.pathname.includes("/rest/v1/menu_items") && u.search.includes("id=in."), async (r) => {
    await new Promise((res) => setTimeout(res, 1500));
    answered = true;
    await r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify([{ id: "old-1", veg: true }]) });
  });
  await page.getByRole("button", { name: "Order again", exact: true }).click();
  await page.getByRole("button", { name: "Delivery" }).click();
  await expect.poll(() => answered, { timeout: 5000 }).toBe(true);
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill|View cart/ })).toHaveCount(0);   // the bag is as it was: empty
  await expect(page.getByRole("button", { name: "Add Veg Thali" })).toBeVisible();
});
