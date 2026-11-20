// Story #1182 part 1: the rider's Navigate needs the order's drop_lat and drop_lng. A returning customer with a saved address (words and exact pin) in the pin code the phone already holds places an order that carries that pin.
import { test, expect } from "@playwright/test";
import { setup, phoneAt } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const HOME = { id: "h1", label: "Home", address: "Z-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };
const quote = { ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000, fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, discount_paise: 0, coupon: null, tax_paise: 0, total_paise: 32000, offers: [] };
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 32000, address: "x", items: [], bill: {}, created_at: "2020-01-01T10:00:00Z", updated_at: "2020-01-01T10:00:00Z" } };

async function toBill(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, saved: object) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [saved];
  const orders: any[] = [];
  await context.route("https://test.supabase.co/functions/v1/quote", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote) }));
  await context.route("https://test.supabase.co/functions/v1/orders", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    orders.push(JSON.parse(r.request().postData() ?? "{}"));
    return r.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) });
  });
  // Story 1529: this address is the place on this phone. With its pin the phone is at it; an old row with no pin is never picked by the app, so the phone holds it (story 1547: a phone that holds a place gets no sheet).
  const row = saved as { id: string; address: string; pin_code: string; lat: number | null; lng: number | null };
  if (row.lat !== null && row.lng !== null) await phoneAt(context, { lat: row.lat, lng: row.lng });
  else await context.addInitScript((r) => { window.localStorage.setItem("gs-place", JSON.stringify({ address: r.address, pin: r.pin_code, lat: null, lng: null, house: "", landmark: "", confirmed: false, id: r.id })); window.localStorage.setItem("gs-pin", r.pin_code); }, row);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await expect(page.getByRole("group", { name: "Serving at" })).toContainText(HOME.address);
  return orders;
}
async function placeFrom(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, saved: object) {
  const orders = await toBill(page, context, saved);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  return orders;
}

test("S1 a saved address with its pin, in the same pin code, puts the pin on the order", async ({ page, context }) => {
  const orders = await placeFrom(page, context, HOME);
  expect(orders).toHaveLength(1);
  expect(orders[0].address.lat).toBeCloseTo(HOME.lat, 4);
  expect(orders[0].address.lng).toBeCloseTo(HOME.lng, 4);
});

test("S2 (story 1532) an old saved address with no pin cannot be ordered to: Confirm on the map opens the map for that address", async ({ page, context }) => {
  const orders = await toBill(page, context, { ...HOME, lat: null, lng: null });
  await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);   // story 1574: the bar reads Confirm on the map, not Place order
  await page.getByRole("button", { name: "Confirm on the map" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByText("Editing Home")).toBeVisible();
  expect(orders).toHaveLength(0);
});
