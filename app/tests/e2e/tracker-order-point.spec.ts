// Story 1497: the customer's tracker is built from the order, not from what the app holds now.
// "You" is the order's own drop point (the pin the customer set), never the postal code's point. No point on the order: no distance and no Home mark.
// The time on the row is the time of the rider's last ping, not the time the row was last written. The rider is told when his phone refuses the location.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const SEEN = new Date(2026, 9, 29, 20, 0, 0);   // 8:00 pm on the phone's own clock
const iso = (ms: number) => new Date(ms).toISOString();
const row = (page: Page) => page.getByRole("button", { name: "See the rider on the map" });
const map = (page: Page) => page.getByRole("region", { name: "Rider on the map" });

async function onTheWay(page: Page, context: BrowserContext, tracking: object) {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: iso(SEEN.getTime()), rider_at: iso(SEEN.getTime() - 20_000), ...tracking };
  await context.route("https://tiles.test/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  await page.clock.setFixedTime(SEEN);
  return net;
}

test("T1 given the order's door is 2 km from the rider and its postal code's point is 1.5 km away, the row says 2.0 km: the distance is to the door", async ({ page, context }) => {
  await onTheWay(page, context, { drop_lat: 28.598, drop_lng: 77.25 });   // the mock's postal code point stays at 28.59, 77.26
  await page.goto("/customer/");
  await expect(row(page)).toContainText("Ravi is 2.0 km away");
});

test("T2 given the postal code has no point and the kitchen has no saved location, the row still shows: both come from the order", async ({ page, context }) => {
  const net = await onTheWay(page, context, { drop_lat: 28.598, drop_lng: 77.25 });
  net.state.pinPoint = null;
  Object.assign(net.state.kitchens[0], { lat: null, lng: null });
  await page.goto("/customer/");
  await expect(row(page)).toContainText("Ravi is 2.0 km away");
});

test("T3 given the order has no drop point, the row shows the rider with no distance, and the map has no Home mark", async ({ page, context }) => {
  await onTheWay(page, context, { drop_lat: null, drop_lng: null });
  await page.goto("/customer/");
  await expect(row(page)).toContainText("Ravi is on the way");
  await expect(row(page)).not.toContainText("away");
  await row(page).click();
  await expect(map(page).getByRole("img", { name: "Rider" })).toBeVisible();
  await expect(map(page).getByRole("img", { name: "Home" })).toHaveCount(0);
  await expect(map(page).getByText("Ravi is on the way")).toBeVisible();
});

test("T4 given the row was written just now but the rider's last ping is 40 minutes old, the row says 40 min ago", async ({ page, context }) => {
  await onTheWay(page, context, { drop_lat: 28.598, drop_lng: 77.25, updated_at: iso(SEEN.getTime()), rider_at: iso(SEEN.getTime() - 40 * 60_000) });
  await page.goto("/customer/");
  await expect(row(page)).toContainText("updated 40 min ago");
});

test("T5 given a place with no ping time, the row does not show; the rider card with its call link stays", async ({ page, context }) => {
  await onTheWay(page, context, { drop_lat: 28.598, drop_lng: 77.25, rider_at: null });
  await page.goto("/customer/");
  await expect(page.getByRole("link", { name: /Call/ })).toBeVisible();
  await expect(row(page)).toHaveCount(0);
});

test("R1 given the rider is online and his phone refuses the location, the rider app says so; with the location allowed it does not", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  await context.clearPermissions();
  await page.goto("/rider/");
  await expect(page.getByRole("status").filter({ hasText: "Location band hai" })).toBeVisible();
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 28.56, longitude: 77.2 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Location band hai" })).toHaveCount(0);
});
