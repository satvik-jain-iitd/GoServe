// Story #552: how you pay on the bill, and paying on the placed screen. Boards P1 to P5 (P2b the pay bar). The payments function and the live order are answered by the test.
// TEST DOUBLE: no money moves; the gateway sheet is a placeholder until the owner's Razorpay click (src/lib/payGateway.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, order, setup, scan as axeScan } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
type Pay = { creates: any[]; cashes: any[]; webhooks: any[]; create: { status: number; body: any }; cash: { status: number; body: any } };

async function withPay(context: BrowserContext, page: Page, initial: Partial<Pay> = {}) {
  const net = await setup(context, page);
  const pay: Pay = { creates: [], cashes: [], webhooks: [], create: { status: 200, body: { ok: true, provider: "fake", provider_order_id: "fake_order_1", amount_paise: 32000, currency: "INR" } },
    cash: { status: 200, body: { ok: true } }, ...initial };
  const json = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/functions/v1/payments/*", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const which = req.url().split("/").pop()!;
    const body = JSON.parse(req.postData() ?? "{}");
    if (which === "create") { pay.creates.push({ body, auth: req.headers()["authorization"] }); return json(route, pay.create.status, pay.create.body); }
    if (which === "webhook") { pay.webhooks.push(body); return json(route, 200, { ok: true, order_id: ID }); }
    pay.cashes.push({ body, auth: req.headers()["authorization"] });
    return json(route, pay.cash.status, pay.cash.body);
  });
  return { net, pay };
}

async function toBill(page: Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
}
async function placeWith(page: Page, how: string) {
  await toBill(page);
  if (how !== "Cash on delivery") await page.getByRole("radio", { name: how }).check();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}

test("S1 the bill asks how you pay, cash is the default, and cash places the order as today", async ({ page, context }) => {
  const { pay } = await withPay(context, page);
  await toBill(page);
  const group = page.getByRole("radiogroup", { name: "How you pay" });
  await expect(group.getByRole("radio")).toHaveCount(3);
  await expect(group.getByRole("radio", { name: "Cash on delivery" })).toBeChecked();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByText("Cash at door")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay now/ })).toHaveCount(0);
  expect(pay.creates).toHaveLength(0);
});

test("S2 UPI: the order is placed, the placed screen waits for payment with a countdown, and Pay now creates the payment for the order", async ({ page, context }) => {
  await page.clock.install({ time: new Date(2026, 9, 27, 12, 0, 0) });
  const { pay } = await withPay(context, page);
  await placeWith(page, "UPI");
  await expect(page.getByText("Waiting for payment · 15:00")).toBeVisible();
  await expect(page.getByRole("button", { name: /UPI · ₹320.*Pay now/ })).toBeVisible();
  expect(pay.creates).toHaveLength(0);   // nothing is asked of the gateway until the customer taps
  await page.clock.runFor(60_000);
  await expect(page.getByText("Waiting for payment · 14:00")).toBeVisible();
  await page.getByRole("button", { name: /Pay now/ }).click();
  await expect.poll(() => pay.creates.length).toBe(1);
  expect(pay.creates[0].body).toEqual({ order_id: ID });   // the amount is never sent: the server reads it from the order
  expect(pay.creates[0].auth).toMatch(/^Bearer /);
  await expect(page.getByRole("status").filter({ hasText: "Waiting for your payment" })).toBeVisible();
  await expect(page.getByText("Test payment: no money moves.")).toBeVisible();
});

test("S3 the dev helper signs the webhook, and when the order turns paid the slip says Paid online", async ({ page, context }) => {
  const { net, pay } = await withPay(context, page);
  await placeWith(page, "UPI");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await page.getByRole("button", { name: "Simulate payment (test)" }).click();
  await expect.poll(() => pay.webhooks.length).toBe(1);
  expect(pay.webhooks[0]).toMatchObject({ provider_order_id: "fake_order_1" });
  expect(pay.webhooks[0].signature).toMatch(/^[0-9a-f]{64}$/);
  net.push("UPDATE", { ...order("placed", new Date().toISOString()), payment_method: "online", paid_at: new Date().toISOString() });
  await expect(page.getByText("Paid online")).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("button", { name: /Pay now/ })).toHaveCount(0);
});

test("S4 an expired payment says nothing was charged and offers Try again or cash", async ({ page, context }) => {
  const { net } = await withPay(context, page);
  await placeWith(page, "UPI");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await expect(page.getByText("Waiting for your payment")).toBeVisible();
  net.push("UPDATE", { ...order("placed", new Date().toISOString()), payment_method: "cod", paid_at: null });   // the database expired it back to cash
  await expect(page.getByText("Nothing was charged.")).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay cash" })).toBeVisible();
});

test("S5 a payment that cannot start says so in plain words and keeps the button", async ({ page, context }) => {
  await withPay(context, page, { create: { status: 502, body: { ok: false, error: "payment_unavailable" } } });
  await placeWith(page, "Card");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not start the payment. Try again." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay now/ })).toBeEnabled();
});

test("S6 Pay cash instead switches the order to cash", async ({ page, context }) => {
  const { pay } = await withPay(context, page);
  await placeWith(page, "UPI");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await page.getByRole("button", { name: "Pay cash instead" }).click();
  await expect.poll(() => pay.cashes.length).toBe(1);
  expect(pay.cashes[0].body).toEqual({ order_id: ID });
  await expect(page.getByText("Cash at door")).toBeVisible();
  await expect(page.getByText("Waiting for your payment")).toHaveCount(0);
});

for (const t of ["day", "night"] as const) {
  test(`S7 the bill choice and the pay screens have no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    await withPay(context, page);
    await toBill(page);
    expect(await axeScan(page)).toEqual([]);
    await page.getByRole("radio", { name: "UPI" }).check();
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByRole("button", { name: /Pay now/ })).toBeVisible();
    expect(await axeScan(page)).toEqual([]);
    await page.getByRole("button", { name: /Pay now/ }).click();
    await expect(page.getByText("Waiting for your payment")).toBeVisible();
    expect(await axeScan(page)).toEqual([]);
  });
}
