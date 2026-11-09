// Story #1182 part 1: the rider's Navigate needs the order's drop_lat and drop_lng. A returning customer with a saved address (words and exact pin) in the pin code the phone already holds places an order that carries that pin.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };
const quote = { ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000, fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, discount_paise: 0, coupon: null, tax_paise: 0, total_paise: 32000, offers: [] };
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 32000, address: "x", items: [], bill: {}, created_at: "2020-01-01T10:00:00Z", updated_at: "2020-01-01T10:00:00Z" } };

test("S1 a saved address with its pin, in the same pin code, puts the pin on the order", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  const orders: any[] = [];
  await context.route("https://test.supabase.co/functions/v1/quote", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote) }));
  await context.route("https://test.supabase.co/functions/v1/orders", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    orders.push(JSON.parse(r.request().postData() ?? "{}"));
    return r.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) });
  });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await expect(page.getByLabel("Address")).toHaveValue(HOME.address);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(orders).toHaveLength(1);
  expect(orders[0].address.lat).toBeCloseTo(HOME.lat, 4);
  expect(orders[0].address.lng).toBeCloseTo(HOME.lng, 4);
});
