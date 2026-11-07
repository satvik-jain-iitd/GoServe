// Story #969: "Use my location" fills the pin even where OpenStreetMap's reverse lookup has no postcode (most of small-town India): the nearest tagged pin within 10 km.
// Replies are recorded (no live calls). The Chhatarpur point is the owner's test point of 7 Nov 2026.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const OSM = { "access-control-allow-origin": "*", "content-type": "application/json" };
const CHHATARPUR = { address: { road: "Link Road", village: "Rajnagar", state_district: "Chhatarpur", state: "Madhya Pradesh", country: "India" } };
const DELHI = { address: { house_number: "B-12", road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110024", country: "India" } };
const NEAR = { elements: [{ type: "node", lat: 24.7, lon: 79.6, tags: { "addr:postcode": "471001" } }, { type: "node", lat: 24.9, lon: 79.7, tags: { "addr:postcode": "471105" } }] };

async function start(context: any, page: Page, nominatim: object, overpass: () => { status: number; body: string } | "abort") {
  await setup(context, page, [], { pin: null });
  const calls = { nominatim: 0, overpass: 0 };
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r: any) => { calls.nominatim++; return r.fulfill({ status: 200, headers: OSM, body: JSON.stringify(nominatim) }); });
  await context.route("https://overpass-api.de/api/interpreter**", (r: any) => {
    calls.overpass++;
    const a = overpass();
    return a === "abort" ? r.abort() : r.fulfill({ status: a.status, headers: OSM, body: a.body });
  });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 24.699, longitude: 79.599 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();
  return calls;
}

test("S1 no postcode from the first lookup: the nearest tagged pin fills the field and the found screen opens", async ({ page, context }) => {
  const calls = await start(context, page, CHHATARPUR, () => ({ status: 200, body: JSON.stringify(NEAR) }));
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await expect(page.getByLabel("Pin code")).toHaveValue("471001");
  await expect(page.getByText("We found this from your location. Fix anything, then go on.")).toBeVisible();
  await expect(page.getByText("We could not find your pin code. Type it.")).toHaveCount(0);
  expect(calls).toEqual({ nominatim: 1, overpass: 1 });
});

test("S2 a fitting postcode from the first lookup makes no second call", async ({ page, context }) => {
  const calls = await start(context, page, DELHI, () => ({ status: 200, body: JSON.stringify(NEAR) }));
  await expect(page.getByLabel("Pin code")).toHaveValue("110024");
  expect(calls).toEqual({ nominatim: 1, overpass: 0 });
});

test("S3 both lookups fail: the pin is empty, the field says so in words, and the customer can go on by hand", async ({ page, context }) => {
  await start(context, page, CHHATARPUR, () => "abort");
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await expect(page.getByLabel("Pin code")).toHaveValue("");
  await expect(page.getByText("We could not find your pin code. Type it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "See the menu" })).toBeDisabled();
  await page.getByLabel("Pin code").fill("471001");
  await expect(page.getByText("We could not find your pin code. Type it.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "See the menu" })).toBeEnabled();
});

test("S4 Overpass answering with nothing near leaves the pin empty with the same words", async ({ page, context }) => {
  await start(context, page, CHHATARPUR, () => ({ status: 200, body: JSON.stringify({ elements: [] }) }));
  await expect(page.getByText("We could not find your pin code. Type it.")).toBeVisible();
});
