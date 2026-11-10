// Story #1295: every amount that changes the total has its own line on the placed slip, so the lines add up to the total (a gift and a discount were missing).
import { test, expect, type Locator } from "@playwright/test";
import { order, setup } from "./helpers";

const slipOf = async (page: import("@playwright/test").Page, context: Parameters<typeof setup>[0], over: Record<string, unknown>) => {
  await setup(context, page, [{ ...order("placed"), items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 32000 }], ...over }]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  return page.locator(".ui-slip").first();
};
const sum = async (slip: Locator) => {
  const rows = await slip.locator(".ui-slip-lines > div span:last-child").allTextContents();
  return rows.reduce((n: number, t: string) => n + (t === "Free" ? 0 : Number(t.replace("−", "-"))), 0);
};

test("P1 a first order with the early friend gift shows the gift line and the lines add up to the total", async ({ page, context }) => {
  const slip = await slipOf(page, context, { total_paise: 22000, bill: { early_friend_paise: 10000, to_pay_paise: 22000 } });
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  await expect(slip.locator(".ui-slip-lines")).toContainText("−100");
  expect(await sum(slip)).toBe(220);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹220");
});

test("P2 a discount has its own line too, and the lines add up", async ({ page, context }) => {
  const slip = await slipOf(page, context, { total_paise: 27000, bill: { discount_paise: 5000, to_pay_paise: 27000 } });
  await expect(slip.getByText("Discount", { exact: true })).toBeVisible();
  expect(await sum(slip)).toBe(270);
});

test("P3 an order with no gift and no discount shows neither line", async ({ page, context }) => {
  const slip = await slipOf(page, context, { total_paise: 32000, bill: { early_friend_paise: 0, discount_paise: 0, to_pay_paise: 32000 } });
  await expect(slip.getByText("Early friend gift")).toHaveCount(0);
  await expect(slip.getByText("Discount", { exact: true })).toHaveCount(0);
  expect(await sum(slip)).toBe(320);
});
