// Story #998, board A2-AddressOla: Use my location asks our geocode function first; the found screen carries the Ola credit line; when it says no, OpenStreetMap answers and the credit line is not shown.
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
  await page.getByRole("button", { name: "Use my location" }).click();
  return { net, osm };
}

test("S1 Ola answers: the words and pin fill in, OpenStreetMap is not asked, the credit line shows", async ({ page, context }) => {
  const { net, osm } = await start(context, page, OLA);
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await expect(page.getByLabel(/Address/)).toHaveValue("Radio Colony, Chhatarpur, Madhya Pradesh");
  await expect(page.getByLabel("Pin code")).toHaveValue("471001");
  const credit = page.getByText(/Address words: Ola Maps/);
  await expect(credit).toBeVisible();
  await expect(credit.getByRole("link", { name: "Ola Maps" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(credit.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  expect(osm.n).toBe(0);
  expect(net.calls.geocode).toHaveLength(1);
});

test("S2 the words stay editable after Ola's answer", async ({ page, context }) => {
  await start(context, page, OLA);
  await page.getByLabel(/Address/).fill("House 4, Radio Colony");
  await expect(page.getByLabel(/Address/)).toHaveValue("House 4, Radio Colony");
});

test("S3 our function says no (off, over the cap, an error): OpenStreetMap answers, no error shows, no Ola credit", async ({ page, context }) => {
  for (const status of [503, 429, 502]) {
    const { osm } = await start(context, page, { status, body: { ok: false } });
    await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
    await expect(page.getByLabel("Pin code")).toHaveValue("471001");
    await expect(page.getByText(/Ola Maps/)).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(osm.n).toBe(1);
    await context.unroute("https://nominatim.openstreetmap.org/reverse**");
  }
});
