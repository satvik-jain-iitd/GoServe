// Story 1609 (owner, 17 Nov 2026): a tapped search result is the customer's own recent at once, marked not confirmed. Confirm on the map updates that same row.
// Run by recent-on-tap.spec.ts (Chromium) and recent-on-tap.webkit.spec.ts (WebKit).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { phoneLoc, setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const AT_HOME = { latitude: 28.5683, longitude: 77.2436 };
const OLA_HIT = { name: "Olaname Market", address: "Olaname Market, Olatown, New Delhi", lat: 28.5599, lng: 77.2065, pin: "110016", served: true, from: "ola" };
const OLA_WORDS = { status: 200, body: { ok: true, address: "Olastreet 9, Olatown, New Delhi", pin: "110016", locality: "Olatown", town: "New Delhi" } };

const search = (page: Page) => page.getByRole("searchbox", { name: "Search an area or address" });
const places = (page: Page) => page.getByRole("region", { name: "Places" });
const pinMap = (page: Page) => page.getByRole("region", { name: "Pin map" });
const recents = (page: Page) => page.getByRole("region", { name: "Recently searched" }).getByRole("listitem");

async function open(page: Page, context: BrowserContext) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.recents = [];
  net.state.nearPin = "110016";
  net.state.places = { status: 200, body: { ok: true, results: [OLA_HIT] } };
  net.state.geocode = OLA_WORDS;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });
  await page.goto("/customer/");
  await page.getByTitle("Change the delivery address").click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  return net;
}

export function recentOnTap() {
  test("a tapped result is a recent at once: one insert, marked not confirmed, and it shows under Recently searched", async ({ page, context }) => {
    const net = await open(page, context);
    await search(page).fill("green park");
    await places(page).getByRole("button").first().click();
    await expect(pinMap(page)).toBeVisible();
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect(recents(page)).toHaveCount(1);
    await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "POST").length).toBe(1);
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")[0].body).toMatchObject({ name: "green park", confirmed: false });
  });

  test("tap, then Confirm on the map: one row, not two (the Confirm updates the tapped row and clears the mark)", async ({ page, context }) => {
    const net = await open(page, context);
    await search(page).fill("green park");
    await places(page).getByRole("button").first().click();
    await expect(pinMap(page)).toBeVisible();
    await page.getByRole("button", { name: "Confirm & proceed" }).click();
    const details = page.getByRole("dialog", { name: "Address details" });
    await details.getByLabel("House, street, colony, ward").fill("12B");
    await details.getByRole("button", { name: "Deliver here" }).click();
    await expect.poll(() => net.calls.recentWrites.length).toBeGreaterThanOrEqual(2);
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")).toHaveLength(1);
    expect(net.calls.recentWrites.filter((w) => w.method === "PATCH").at(-1)!.body).toMatchObject({ confirmed: true });
    expect(net.state.recents).toHaveLength(1);
  });
}
