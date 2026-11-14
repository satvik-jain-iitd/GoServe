// Story #691 (boards T2 and T3): once the order is On the way, the customer sees the rider move on a map. Leaflet is loaded only then; the tiles come from
// the build's VITE_MAP_TILES (the test build points it at tiles.test, which the test answers). The rider's place is the order_tracking row, pushed over realtime.
import { test, expect, type Page } from "@playwright/test";
import { order, scan, setup } from "./helpers";

const SEEN = new Date(2026, 9, 29, 20, 0, 0);   // 8:00 pm on the phone's own clock
const iso = (ms: number) => new Date(ms).toISOString();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function onTheWay(page: Page, context: Parameters<typeof setup>[0], withPlace = true) {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  Object.assign(net.state.kitchens[0], { lat: 28.57, lng: 77.24 });
  if (withPlace) net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: iso(SEEN.getTime() - 20_000) };
  const tiles: string[] = [];
  await context.route("https://tiles.test/**", (route) => { tiles.push(route.request().url()); return route.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
  await page.clock.setFixedTime(SEEN);
  return { net, tiles };
}
const map = (page: Page) => page.getByRole("region", { name: "Rider on the map" });
const row = (page: Page) => page.getByRole("button", { name: "See the rider on the map" });

test("S1 On the way with a place: a rider row and no map in the page; the row opens the full-screen map with Home and the rider (no kitchen mark), the card, the attribution and Call the rider", async ({ page, context }) => {
  const { tiles } = await onTheWay(page, context);
  await page.goto("/customer/");
  await expect(row(page)).toContainText("Ravi is 1.5 km away");
  await expect(row(page)).toContainText("On the map · updated 20 sec ago");
  await expect(page.locator(".ui-map-box")).toHaveCount(0);   // no map in the page
  expect(tiles).toEqual([]);   // and no tile asked for before the map is opened
  await row(page).click();
  await expect(map(page)).toBeVisible();
  await expect(map(page).getByRole("img", { name: "Kitchen" })).toHaveCount(0);   // board T5: no kitchen mark once the rider is on the way
  await expect(map(page).getByRole("img", { name: "Home" })).toBeVisible();
  await expect(map(page).getByRole("img", { name: "Rider" })).toContainText("Ravi");   // the dot is labelled with the name
  await expect(map(page).getByText("Ravi is 1.5 km away")).toBeVisible();
  await expect(map(page).getByText(/^At your door by .* · updated 20 sec ago$/)).toBeVisible();
  await expect(map(page).getByText("Live", { exact: true })).toHaveCount(0);   // story 1497: no Live pill; the place can be old and the card says how old
  await expect(map(page).getByText("© OpenStreetMap contributors")).toBeVisible();
  await expect(map(page).getByRole("link", { name: "Call the rider" })).toHaveAttribute("href", "tel:9876500000");
  const full = await map(page).boundingBox();
  const vp = page.viewportSize()!;
  expect([Math.round(full!.width), Math.round(full!.height)]).toEqual([vp.width, vp.height]);
  await expect.poll(() => tiles.length).toBeGreaterThan(0);
  await scan(page);
  await map(page).getByRole("button", { name: "Back to your order" }).click();
  await expect(map(page)).toHaveCount(0);
  await expect(row(page)).toBeVisible();
});

test("S2 a new ping over realtime changes the words of the row and of the map within seconds", async ({ page, context }) => {
  const { net } = await onTheWay(page, context);
  await page.goto("/customer/");
  await expect(row(page)).toContainText("Ravi is 1.5 km away");
  net.state.tracking = { rider_lat: 28.588, rider_lng: 77.258, updated_at: iso(SEEN.getTime() - 5_000) };
  net.push("UPDATE", { order_id: "x", ...net.state.tracking }, "order_tracking");
  await expect(row(page)).toContainText("Ravi is 300 m away", { timeout: 5000 });
  await expect(row(page)).toContainText("updated 5 sec ago");
  await row(page).click();
  await expect(map(page).getByText("Ravi is 300 m away")).toBeVisible();
});

test("S3 no connection: the row and the map card say when the rider was last seen, and the map is greyed", async ({ page, context }) => {
  await onTheWay(page, context);
  await page.clock.setFixedTime(new Date(SEEN.getTime() + 120_000));
  await page.goto("/customer/");
  await expect(row(page)).toContainText("Ravi is");
  await row(page).click();
  await context.setOffline(true);
  await expect(map(page).getByText("No connection")).toBeVisible();
  await expect(map(page).getByText("Last seen 7:59 pm, 2 min ago")).toBeVisible();
  await expect(map(page).locator("[data-offline='true']")).toHaveCount(1);
});

test("S4 no map before On the way, and none while the database has no place for the rider", async ({ page, context }) => {
  const a = await setup(context, page, [order("ready", "2020-01-01T10:04:00Z")]);
  a.state.riderCard = { name: "Ravi", phone: "9876500000" };
  a.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, updated_at: iso(SEEN.getTime()) };
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  await expect(map(page)).toHaveCount(0);
});

test("S5 On the way but no place yet: no row and no map, the rider card with its call link stays", async ({ page, context }) => {
  await onTheWay(page, context, false);
  await page.goto("/customer/");
  await expect(page.getByTestId("rider-card")).toContainText("Ravi");
  await expect(row(page)).toHaveCount(0);
  await expect(map(page)).toHaveCount(0);
});
