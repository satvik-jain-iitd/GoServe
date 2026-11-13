// Story #905: the order keeps the customer's drop point. A device fix is saved as drop_lat and drop_lng; a typed address sends none.
import { test, expect, type Page } from "@playwright/test";
import { setup, typePlace } from "./helpers";
import { firstOpenToMenu } from "./firstOpen";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const NOMINATIM = { address: { house_number: "B-12", road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } };
const quote = { ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 25000, fees: { delivery_paise: 4000, packaging_paise: 0, total_paise: 4000 }, discount_paise: 0, coupon: null, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 29000, saved_paise: 0, offers: [] };
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 29000, address: "x", items: [], bill: {}, created_at: "2026-11-06T10:00:00Z" } };

async function start(context: any, page: Page) {
  await setup(context, page, [], { pin: null });
  const orders: any[] = [];
  await context.route("https://test.supabase.co/functions/v1/quote", (r: any) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote) }));
  await context.route("https://test.supabase.co/functions/v1/orders", (r: any) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    orders.push(JSON.parse(r.request().postData() ?? "{}"));
    return r.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) });
  });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r: any) => r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(NOMINATIM) }));
  return orders;
}
async function orderFromBill(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}

test("S1 an order placed after the pin map carries the drop point", async ({ page, context }) => {
  const orders = await start(context, page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await page.goto("/customer/");
  await firstOpenToMenu(page);
  await orderFromBill(page);
  expect(orders).toHaveLength(1);
  expect(orders[0].address.lat).toBeCloseTo(28.5677, 3);
  expect(orders[0].address.lng).toBeCloseTo(77.2432, 3);
});

test("S2 an order placed from a typed address carries no drop point", async ({ page, context }) => {
  const orders = await start(context, page);
  await page.goto("/customer/");
  await typePlace(page, "110016", "Flat 4, Green Park");

  await orderFromBill(page);
  expect(orders).toHaveLength(1);
  expect(orders[0].address.lat).toBeUndefined();
  expect(orders[0].address.lng).toBeUndefined();
});
