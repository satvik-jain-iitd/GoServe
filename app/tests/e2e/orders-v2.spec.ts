// Story #590: the order goes through POST /orders (backend v2) when this phone has gs-orders-v2=1 (VITE_ORDERS_V2 is off in every deploy until the switch).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const quoteOf = (toPay: number) => ({
  ok: true, kitchen_id: "k-1", lines: [], item_total_paise: toPay - 4000, fees: { delivery_paise: 4000, packaging_paise: 0, total_paise: 4000 },
  discount_paise: 0, coupon: null, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: toPay, saved_paise: 0, offers: [],
});
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 30000, address: "Flat 4, Green Park", items: [], bill: {}, created_at: new Date().toISOString() } };

async function start(context: any, page: any, orderAnswers: { status: number; body: unknown }[]) {
  await context.addInitScript(() => { try { localStorage.setItem("gs-orders-v2", "1"); } catch { /* blocked */ } });
  await setup(context, page);
  const seen = { quotes: 0, orders: [] as any[], v1: 0 };
  let toPay = 29000;
  await context.route("https://test.supabase.co/functions/v1/quote", async (route: any) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    seen.quotes++;
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quoteOf(toPay)) });
  });
  await context.route("https://test.supabase.co/functions/v1/orders", async (route: any) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    seen.orders.push(JSON.parse(route.request().postData() ?? "{}"));
    const a = orderAnswers[Math.min(seen.orders.length - 1, orderAnswers.length - 1)];
    return route.fulfill({ status: a.status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(a.body) });
  });
  await context.route("https://orders.test/**", async (route: any) => { if (route.request().method() !== "OPTIONS") seen.v1++; return route.fallback(); });
  return seen;
}
async function toBill(page: any) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
}

test("S1 the order goes to POST /orders with the price on the bill, and the v1 webhook is not called", async ({ page, context }) => {
  const seen = await start(context, page, [{ status: 201, body: placed }]);
  await toBill(page);
  await expect(page.getByTestId("bill-total")).toHaveText("₹290");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(seen.orders).toHaveLength(1);
  expect(seen.orders[0]).toMatchObject({ kitchen_id: "k-1", expected_to_pay_paise: 29000, address: { pin_code: "110016", text: "Flat 4, Green Park" }, lines: [{ menu_item_id: "d1", qty: 1 }] });
  expect(seen.orders[0].idempotency_key.length).toBeGreaterThanOrEqual(8);
  expect(seen.v1).toBe(0);
});

test("S2 Rs 290 became Rs 300: the Bill shows the new price and no order is made until the customer taps again", async ({ page, context }) => {
  const seen = await start(context, page, [
    { status: 409, body: { ok: false, error: "price_changed", message: "A price changed. Check the bill again.", quote: quoteOf(30000) } },
    { status: 201, body: placed },
  ]);
  await toBill(page);
  await expect(page.getByTestId("bill-total")).toHaveText("₹290");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByTestId("bill-total")).toHaveText("₹300");
  await expect(page.getByText("The price changed. Check the new total, then tap Place order.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order placed" })).toHaveCount(0);
  expect(seen.orders).toHaveLength(1);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(seen.orders).toHaveLength(2);
  expect(seen.orders[1].expected_to_pay_paise).toBe(30000);
  expect(seen.orders[1].idempotency_key).toBe(seen.orders[0].idempotency_key);
});

test("S3 a refusal shows our line, not the server's words", async ({ page, context }) => {
  await start(context, page, [{ status: 422, body: { ok: false, error: "sold_out", message: "Butter Chicken is sold out." } }]);
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Something in the bill did not go through. Check it and try again.")).toBeVisible();
  await expect(page.getByText("Butter Chicken is sold out.")).toHaveCount(0);
});

test("S4 without the flag the order still goes through the v1 webhook", async ({ page, context }) => {
  await setup(context, page);
  let v2 = 0;
  await context.route("https://test.supabase.co/functions/v1/orders", async (route: any) => { v2++; return route.fulfill({ status: 500, body: "{}" }); });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(v2).toBe(0);
});
