// Story #998, board A2-AddressOla: Use my location asks our geocode function first; the pin map card carries the Ola credit line; when it says no, OpenStreetMap answers and the credit line is not shown.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const OSM = { "access-control-allow-origin": "*", "content-type": "application/json" };
const OLA = { status: 200, body: { ok: true, address: "Radio Colony, Chhatarpur, Madhya Pradesh", pin: "471001", locality: "Radio Colony", town: "Chhatarpur" } };
const CHHATARPUR = { address: { road: "Link Road", village: "Rajnagar", state_district: "Chhatarpur", state: "Madhya Pradesh", postcode: "471001", country: "India" } };

async function start(context: any, page: Page, geocode: { status: number; body: object } | null) {
  const net = await setup(context, page, [], { pin: null });
  net.state.geocode = geocode;
  const osm = { n: 0 };
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r: any) => { osm.n++; return r.fulfill({ status: 200, headers: OSM, body: JSON.stringify(CHHATARPUR) }); });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 24.9, longitude: 79.58 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Set delivery location" }).click();
  return { net, osm };
}

test("S1 Ola answers: the words show on the pin map card, OpenStreetMap is not asked, the credit line shows", async ({ page, context }) => {
  const { net, osm } = await start(context, page, OLA);
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByText("Radio Colony", { exact: true })).toBeVisible();
  const credit = page.locator(".ui-pinmap-credit");
  await expect(credit.getByRole("link", { name: "Ola Maps" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(credit.getByRole("link", { name: /OpenStreetMap contributors/ })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  expect(osm.n).toBe(0);
  expect(net.calls.geocode.length).toBeGreaterThan(0);
});

test("S3 our function says no (off, over the cap, an error): OpenStreetMap answers, no error shows, no Ola credit", async ({ page, context }) => {
  for (const status of [503, 429, 502]) {
    const { osm } = await start(context, page, { status, body: { ok: false } });
    await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
    await expect(page.getByText("Link Road", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".ui-pinmap-credit").getByText("Ola Maps")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(osm.n).toBeGreaterThan(0);
    await context.unroute("https://nominatim.openstreetmap.org/reverse**");
  }
});
