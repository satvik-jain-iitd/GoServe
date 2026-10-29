// Story #619 layer c (board L3): a dish in the bill that went sold out. The Bill says why, offers the server's one alternative with the swap discount,
// and has two ways out: Swap it in, Take it out. No alternative: the item goes out and the menu opens with the dish stamped Sold out.
// POST /quote and POST /orders are answered by the test, as the real functions answer (layer b). The swap runs on the v2 order path (gs-orders-v2=1).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const PANEER = { id: "d1", name: "Paneer Butter Masala", price_paise: 26000, image_url: null, image_credit: null, veg: true, available: true };
const DAL = { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, available: true };
const ROTI = { id: "d3", name: "Tandoori Roti", price_paise: 2000, image_url: null, image_credit: null, veg: true, available: true };
const ALT = { menu_item_id: "d2", name: "Dal Makhani", price_paise: 22000, discount_paise: 2200 };
const quoteOf = (lines: object[], itemTotal: number, swapDiscount = 0) => ({
  ok: true, kitchen_id: "k-1", lines, item_total_paise: itemTotal, fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, discount_paise: swapDiscount,
  coupon: null, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: itemTotal - swapDiscount, saved_paise: swapDiscount, offers: [],
  ...(swapDiscount ? { swap_discount_paise: swapDiscount, swaps: [{ from: "d1", to: "d2", discount_paise: swapDiscount }] } : {}),
});
const line = (d: typeof PANEER, qty: number) => ({ menu_item_id: d.id, name: d.name, qty, unit_paise: d.price_paise, extras_paise: 0, line_paise: d.price_paise * qty, options: [] });
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 24000, address: "Flat 4", items: [], bill: {}, created_at: new Date().toISOString() } };

async function start(context: BrowserContext, page: Page, alt: object | null) {
  await context.addInitScript(() => { try { localStorage.setItem("gs-orders-v2", "1"); } catch { /* blocked */ } });
  const net = await setup(context, page);
  net.state.menu = [PANEER, DAL, ROTI];
  const seen = { quotes: [] as any[], orders: [] as any[] };
  await context.route("https://test.supabase.co/functions/v1/quote", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const b = JSON.parse(route.request().postData() ?? "{}");
    seen.quotes.push(b);
    const lines: { menu_item_id: string; qty: number; swap?: boolean }[] = b.lines;
    const dead = lines.find((l) => l.menu_item_id === "d1");
    const answer = (status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (dead && !dead.swap) return answer(422, { ok: false, error: "dish_sold_out", message: "Paneer Butter Masala is sold out.", alternative: alt });
    const out = lines.flatMap((l) => (l.menu_item_id === "d1" ? [line(DAL, l.qty)] : [line(l.menu_item_id === "d2" ? DAL : ROTI, l.qty)]));
    const total = out.reduce((n, l: any) => n + l.line_paise, 0);
    return answer(200, quoteOf(out, total, dead ? 2200 * dead.qty : 0));
  });
  await context.route("https://test.supabase.co/functions/v1/orders", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    seen.orders.push(JSON.parse(route.request().postData() ?? "{}"));
    return route.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) });
  });
  return { net, seen };
}
async function toSoldOutBill(page: Page, net: any) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Paneer Butter Masala" }).click();
  await page.getByRole("button", { name: "Add Tandoori Roti" }).click();
  net.state.menu = [{ ...PANEER, available: false }, DAL, ROTI];
  net.push("UPDATE", { ...PANEER, available: false }, "menu_items");
  await expect(page.locator("article").filter({ hasText: "Paneer Butter Masala" }).getByText("Sold out", { exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /View bill/ }).click();
}

test("S1 the bill says why, offers the one alternative with the discount, and will not place until it is fixed", async ({ page, context }) => {
  const { net } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  const alert = page.getByRole("alert").filter({ hasText: "is sold out." });
  await expect(alert.getByText("Paneer Butter Masala is sold out.")).toBeVisible();
  await expect(alert.getByText("Try Dal Makhani instead")).toBeVisible();
  await expect(alert.getByText("10% off from us, sorry for the trouble")).toBeVisible();
  await expect(alert.getByText("₹198")).toBeVisible();
  await expect(alert.getByRole("button", { name: "Swap it in" })).toBeVisible();
  await expect(alert.getByRole("button", { name: "Take it out" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
});

test("S2 Swap it in: the new dish and the discount are on the bill, and the order carries the swap", async ({ page, context }) => {
  const { net, seen } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  await page.getByRole("button", { name: "Swap it in" }).click();
  const slip = page.getByRole("region", { name: "Items" });
  await expect(slip.getByText("1 × Dal Makhani")).toBeVisible();
  await expect(slip.getByText("Swap discount")).toBeVisible();
  await expect(slip.getByText("−22")).toBeVisible();
  await expect(page.getByTestId("bill-total")).toHaveText("₹218");   // 22000 + 2000 less 2200
  expect(seen.quotes.at(-1).lines.find((l: any) => l.menu_item_id === "d1")).toMatchObject({ swap: true, qty: 1 });
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(seen.orders[0].lines.find((l: any) => l.menu_item_id === "d1")).toMatchObject({ swap: true, qty: 1 });
  expect(seen.orders[0].expected_to_pay_paise).toBe(21800);
});

test("S3 Take it out: the dish leaves the bill and the rest is kept", async ({ page, context }) => {
  const { net } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  await page.getByRole("button", { name: "Take it out" }).click();
  const slip = page.getByRole("region", { name: "Items" });
  await expect(slip.getByText("1 × Tandoori Roti")).toBeVisible();
  await expect(slip.getByText("Paneer Butter Masala")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "is sold out." })).toHaveCount(0);
});

test("S4 no alternative: the item goes out, the rest of the bill is kept, and the menu opens with the dish stamped Sold out", async ({ page, context }) => {
  const { net } = await start(context, page, null);
  await toSoldOutBill(page, net);
  await expect(page.locator("article").filter({ hasText: "Paneer Butter Masala" }).getByText("Sold out", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("1 item");   // the roti is kept
});
