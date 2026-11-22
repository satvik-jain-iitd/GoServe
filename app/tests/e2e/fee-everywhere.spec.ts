// Story 1757 (epic 1753): with a delivery fee, every screen says the same total and the same Delivery line. Refs #1268, story 780.
// Basket in these cases: one Butter Chicken at 180 plus a fee of 20 is 200 (the bill case uses the shared step's 320 plus 20: 340).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";
import { STEPS } from "./screensSteps";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const ITEMS = [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 18000 }];
const billOf = (fee: number) => ({ item_total_paise: 18000, fees: { delivery_paise: fee, packaging_paise: 0, total_paise: fee }, discount_paise: 0, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 18000 + fee });
const withFee = (o: object, fee: number) => ({ ...o, items: ITEMS, total_paise: 18000 + fee, bill: billOf(fee), paid_by: null });
const OLD_ID = `${ID.slice(0, -1)}7`;   // an order placed when the fee was 0
const rupees = (t: string) => Number(t.replace(/[₹,\s]/g, "").replace("−", "-"));

test("AC-1 Bill: with a fee of 20 the Delivery row says 20 (not Free) and To pay is the lines plus the fee", async ({ page, context }) => {
  await STEPS["bill"](context, page, "/customer/");
  await context.route((u) => u.pathname === "/functions/v1/quote", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) :
    route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: true, item_total_paise: 32000, fees: { delivery_paise: 2000, packaging_paise: 0, total_paise: 2000 }, discount_paise: 0, coupon: null, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 34000, offers: [] }) }));
  await page.reload();
  const amount = (label: string) => page.getByText(label, { exact: true }).locator("..").locator("span").last();
  await expect(amount("To pay")).toHaveText("₹340");
  await expect(amount("Delivery")).toHaveText("20");
  await expect(page.getByText("Free", { exact: true })).toHaveCount(0);
});

test("AC-6 Bill: with a fee of 0 the Delivery row says Free as today", async ({ page, context }) => {
  await STEPS["bill"](context, page, "/customer/");
  await expect(page.getByText("Delivery", { exact: true }).locator("..").locator("span").last()).toHaveText("Free");
});

async function deliveredSlip(context: BrowserContext, page: Page, fee: number) {
  const net = await setup(context, page, [withFee(order("out_for_delivery"), fee)]);   // the order carries the fee it was placed with
  await page.goto("/customer/");
  await expect(page.getByRole("list", { name: "Order progress" })).toBeVisible();
  net.push("UPDATE", { ...withFee(order("delivered", new Date(2026, 10, 14, 21, 30).toISOString()), fee), delivered_at: new Date(2026, 10, 14, 20, 8).toISOString(), paid_by: "cash" });
  const slip = page.getByRole("region", { name: "Order, delivered" });
  await expect(slip).toBeVisible();
  return slip;
}

test("AC-2 Order slip, delivered: Delivery 20 (no Free) and the total 200", async ({ page, context }) => {
  const slip = await deliveredSlip(context, page, 2000);
  await expect(slip.locator(".ui-slip-lines").getByText("Delivery", { exact: true }).locator("..").locator("span").last()).toHaveText("20");
  await expect(slip.getByText("Free", { exact: true })).toHaveCount(0);   // #1268: the row is not Free when the total carries a fee
  await expect(slip.locator(".ui-slip-total span").last()).toHaveText(/200$/);
});

test("AC-2 Order slip, placed: Delivery 20 and the total 200", async ({ page, context }) => {
  await setup(context, page, [withFee(order("placed"), 2000)]);
  await page.goto("/customer/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip.locator(".ui-slip-lines").getByText("Delivery", { exact: true }).locator("..").locator("span").last()).toHaveText("20");
  await expect(slip.getByText("Free", { exact: true })).toHaveCount(0);
  await expect(slip.locator(".ui-slip-total span").last()).toHaveText(/200$/);
});

test("AC-6 Order slip: with a fee of 0 it says Delivery Free", async ({ page, context }) => {
  const slip = await deliveredSlip(context, page, 0);
  await expect(slip.locator(".ui-slip-lines").getByText("Delivery", { exact: true }).locator("..").locator("span").last()).toHaveText("Free");
});

test("AC-3 History: an order with a fee says 200, and an order placed at fee 0 still says its own 180", async ({ page, context }) => {
  await setup(context, page, [withFee(order("delivered", "2020-01-01T12:00:00Z", "2020-01-01T11:30:00Z"), 2000), { ...withFee(order("delivered", "2020-01-01T10:00:00Z", "2020-01-01T09:30:00Z"), 0), id: OLD_ID, client_order_key: "k7" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("₹200", { exact: true })).toHaveCount(1);
  await expect(page.getByText("₹180", { exact: true })).toHaveCount(1);
});

test("AC-4 Rider Collect payment: To collect 200; an order placed at fee 0 collects its own 180", async ({ page, context }) => {
  for (const [fee, want] of [[2000, "₹200"], [0, "₹180"]] as const) {
    const net = await setup(context, page, [{ ...withFee(order("out_for_delivery", new Date().toISOString(), new Date().toISOString()), fee), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9000000000" }]);
    net.state.qrObject = null;
    await page.goto("/rider/");
    await page.getByRole("button", { name: "Arriving 0f0f0f0f" }).click();
    await page.getByRole("button", { name: "Collect", exact: true }).click();
    await expect(page.getByTestId("collect-total")).toHaveText(want);
  }
});

const adminSlip = async (context: BrowserContext, page: Page, row: object) => {
  const net = await setup(context, page, [{ ...row, customer_name: "Asha", customer_phone: "9000000000" }]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
  return page.locator(".ui-slip").first();
};
const deliveryRow = (slip: ReturnType<Page["locator"]>) => slip.locator(".ui-slip-lines").getByText("Delivery", { exact: true }).locator("..").locator("span").last();

test("AC-5 Admin One order: Delivery 20, Cash at door 200, and the lines add up to it", async ({ page, context }) => {
  const slip = await adminSlip(context, page, withFee(order("preparing"), 2000));
  await expect(deliveryRow(slip)).toHaveText("₹20");
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹200");
  const parts = await slip.locator(".ui-slip-lines :scope > div span:last-child, .ui-slip-lines > div span:last-child").allTextContents();
  expect(parts.map(rupees).reduce((n, v) => n + v, 0)).toBe(200);
});

test("AC-6 and story 780 Admin One order: with a bill and a fee of 0 it says Delivery Free", async ({ page, context }) => {
  const slip = await adminSlip(context, page, withFee(order("preparing"), 0));
  await expect(deliveryRow(slip)).toHaveText("Free");
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹180");
});

test("story 780 Admin One order: an order with no bill prints no Delivery line, only its own total", async ({ page, context }) => {
  const slip = await adminSlip(context, page, { ...order("preparing"), total_paise: 18000, items: ITEMS, bill: null });
  await expect(slip.getByText("Delivery", { exact: true })).toHaveCount(0);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹180");
});

test("an old order keeps its own total after the fee is 2000: slip, admin and rider read the stored order, not the setting", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...withFee(order("preparing"), 0), id: OLD_ID, rider_id: SESSION, customer_name: "Asha", customer_phone: "9000000000" }]);
  net.state.feePaise = 2000;   // the admin has set the fee since this order was placed
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f|^Open order/ }).first().click();
  const slip = page.locator(".ui-slip").first();
  await expect(deliveryRow(slip)).toHaveText("Free");
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹180");
});

test("kitchen app: the order sheet prints no money at all, and the Today line sums the stored totals", async ({ page, context }) => {
  const net = await setup(context, page, [withFee(order("placed"), 2000)]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("dialog", { name: "Order 0f0f0f0f" }).getByText("₹")).toHaveCount(0);
});

test("AC-7 the fee line adds no height at 360x640: the delivered slip and the admin slip scroll the same with a fee of 20 and of 0 (the Delivery row is one row either way)", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const over = () => page.evaluate(() => Math.max(...Array.from(document.querySelectorAll<HTMLElement>(".ui-scroll, main, body")).map((e) => e.scrollHeight - e.clientHeight)));
  const heights: number[][] = [];
  for (const fee of [2000, 0]) {
    await deliveredSlip(context, page, fee);
    const d = await over();
    const adm = await adminSlip(context, page, withFee(order("preparing"), fee));
    await expect(adm).toBeVisible();
    heights.push([d, await page.locator(".ui-scroll").first().evaluate((e) => e.scrollHeight - e.clientHeight)]);
  }
  expect(Math.abs(heights[0][0] - heights[1][0])).toBeLessThanOrEqual(1);
  expect(Math.abs(heights[0][1] - heights[1][1])).toBeLessThanOrEqual(1);
});
