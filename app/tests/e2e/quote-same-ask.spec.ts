// Story #995: the Bill's quote and Place order carry the same coupon question (the server's best, a code, or none), so the total the Bill shows is the total the server computes.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const FLAT50 = { code: "FLAT50", title: "Rs 50 off", saves_paise: 5000 };
const bill = (coupon: { code: string; title: string } | null, discount: number) => ({
  ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000, fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, discount_paise: discount, coupon, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 32000 - discount, saved_paise: discount, offers: [FLAT50],
});
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 27000, address: "x", items: [], bill: {}, created_at: "2026-11-06T10:00:00Z", instructions: null } };

test("S1 the order asks what the last quote asked: the server's best, then none after Remove", async ({ page, context }) => {
  await setup(context, page);
  const quotes: any[] = [], orders: any[] = [];
  await context.route("https://test.supabase.co/functions/v1/quote", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    const b = JSON.parse(r.request().postData() ?? "{}"); quotes.push(b);
    return r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(b.no_coupon ? bill(null, 0) : bill({ code: "FLAT50", title: "Rs 50 off" }, 5000)) });
  });
  await context.route("https://test.supabase.co/functions/v1/orders", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    orders.push(JSON.parse(r.request().postData() ?? "{}"));
    return r.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) });
  });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByTestId("bill-total")).toHaveText("₹270");
  await page.getByRole("button", { name: "Remove FLAT50" }).click();
  await expect(page.getByTestId("bill-total")).toHaveText("₹320");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  const last = quotes.at(-1);
  expect(last.no_coupon).toBe(true);
  expect(orders[0].no_coupon).toBe(last.no_coupon);
  expect(orders[0].coupon_code).toBe(last.coupon_code);
  expect(orders[0].expected_to_pay_paise).toBe(32000);
});
