// Story 1498 (owner, 14 Nov 2026, decision D08; no new board: the order screen stays as on board T4): only the tap on the rider row changes.
// It opens Google Maps with the route drawn from the rider's last place (the start) to the order's map pin (the end), never the reverse.
// An order with no map pin opens only the rider's last place: no route, no postal code point, no address text.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const SEEN = new Date(2026, 9, 29, 20, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const row = (page: Page) => page.getByRole("link", { name: "See the rider on Google Maps" });

async function onTheWay(page: Page, context: BrowserContext, tracking: object = {}) {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: iso(SEEN.getTime()), rider_at: iso(SEEN.getTime() - 20_000), drop_lat: 28.598, drop_lng: 77.25, ...tracking };
  await page.clock.setFixedTime(SEEN);
  await page.goto("/customer/");
}

test("G1 the tap opens Google Maps with the route from the rider's last place to the order's pin: the start is the rider, the end is the customer", async ({ page, context }) => {
  await onTheWay(page, context);
  const href = new URL((await row(page).getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://www.google.com/maps/dir/");
  expect(href.searchParams.get("origin")).toBe("28.58,77.25");          // the rider
  expect(href.searchParams.get("destination")).toBe("28.598,77.25");   // the order's map pin
  expect([href.searchParams.get("api"), href.searchParams.get("travelmode")]).toEqual(["1", "two-wheeler"]);
  await expect(row(page)).toHaveAttribute("target", "_blank");
  await expect(row(page)).toHaveAttribute("rel", /noopener/);
});

test("G2 the order screen stays as it is: the same row words and the Live mark", async ({ page, context }) => {
  await onTheWay(page, context);
  await expect(row(page)).toContainText("Ravi is 2.0 km away");
  await expect(row(page)).toContainText("On the map · updated 20 sec ago");
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
});

test("G3 an order with no map pin opens only the rider's last place: no route", async ({ page, context }) => {
  await onTheWay(page, context, { drop_lat: null, drop_lng: null });
  await expect(row(page)).toContainText("Ravi is on the way");
  const href = new URL((await row(page).getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://www.google.com/maps/search/");
  expect([href.searchParams.get("api"), href.searchParams.get("query")]).toEqual(["1", "28.58,77.25"]);
  expect(href.searchParams.has("destination")).toBe(false);
});

test("G4 the tap does not open a map inside the app", async ({ page, context }) => {
  await onTheWay(page, context);
  await context.route("https://www.google.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>maps</title>" }));
  const [tab] = await Promise.all([context.waitForEvent("page"), row(page).click()]);
  expect(new URL(tab.url()).hostname).toBe("www.google.com");
  await expect(page.getByRole("region", { name: "Rider on the map" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "See the rider on the map" })).toHaveCount(0);
});
