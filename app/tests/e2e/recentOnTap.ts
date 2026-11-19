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

// Story 1626: a tapped result keeps its own name, its postal code (the result's, else ours) and its source.
const SAMPLE = { name: "Sample Junction", address: "Sample Junction, Sample Road, Sampletown", lat: 28.5599, lng: 77.2065, pin: "", served: true, from: "ola" };
const SAMPLE_PIN = { ...SAMPLE, address: "Sample Junction, Sample Road, Sampletown 110016", pin: "110016" };
const SAMPLE_OWN = { ...SAMPLE, from: "own", pin: "110016" };

async function openTap(page: Page, context: BrowserContext, hit: object, { nearPin = null }: { nearPin?: string | null } = {}) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.recents = [];
  net.state.nearPin = nearPin;
  net.state.places = { status: 200, body: { ok: true, results: [hit] } };
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
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")[0].body).toMatchObject({ name: "Olaname Market", confirmed: false });
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

  // Gap 1 (reviewer, #1615): a recent that was only tapped (not confirmed) opens the pin map at its point; no place is chosen until Confirm, which updates the same row.
  test("a tapped-only recent opens the pin map at its point and chooses nothing until Confirm", async ({ page, context }) => {
    const net = await open(page, context);
    await search(page).fill("green park");
    await places(page).getByRole("button").first().click();
    await expect(pinMap(page)).toBeVisible();
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect(recents(page)).toHaveCount(1);
    const before = await page.evaluate(() => window.localStorage.getItem("gs-place"));
    await recents(page).first().click();
    await expect(pinMap(page)).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem("gs-place"))).toBe(before);   // no place is chosen until Confirm
    await page.getByRole("button", { name: "Confirm & proceed" }).click();
    const details = page.getByRole("dialog", { name: "Address details" });
    await details.getByLabel("House, street, colony, ward").fill("12B");
    await details.getByRole("button", { name: "Deliver here" }).click();
    await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "PATCH").at(-1)?.body?.confirmed).toBe(true);
    expect(net.state.recents).toHaveLength(1);   // the same row, confirmed
  });

  // Gap 2 (reviewer, #1615): the tap's insert is held back; a fast Confirm waits for it and updates that row. No second row.
  test("a fast Confirm after a held-back tap updates the tapped row: one row, not two", async ({ page, context }) => {
    const net = await open(page, context);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await context.route("**/rest/v1/recent_places**", async (route, req) => {
      if (req.method() === "POST") await gate;   // the tap's insert waits here
      await route.fallback();
    });
    await search(page).fill("green park");
    await places(page).getByRole("button").first().click();
    await expect(pinMap(page)).toBeVisible();
    await page.getByRole("button", { name: "Confirm & proceed" }).click();
    const details = page.getByRole("dialog", { name: "Address details" });
    await details.getByLabel("House, street, colony, ward").fill("12B");
    await details.getByRole("button", { name: "Deliver here" }).click();
    release();
    await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "PATCH").length).toBeGreaterThanOrEqual(1);
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")).toHaveLength(1);
    expect(net.state.recents).toHaveLength(1);
  });

  // T10 (story 1626): the name comes from the tapped result. Green before the change; kept as a guard.
  test("T10: a tapped Ola result is one recent row named after the result", async ({ page, context }) => {
    await openTap(page, context, SAMPLE);
    await search(page).fill("samp");
    await places(page).getByRole("button").first().click();
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect(recents(page)).toHaveCount(1);
    await expect(recents(page).first()).toContainText("Sample Junction");
  });

  // T6 (story 1626): the row keeps the result's name, its address, no postal code (none known), source ola, not confirmed.
  test("T6: a tapped Ola result is saved with its address, source ola and not confirmed", async ({ page, context }) => {
    const net = await openTap(page, context, SAMPLE);
    await search(page).fill("samp");
    await places(page).getByRole("button").first().click();
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "POST").length).toBe(1);
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")[0].body).toMatchObject({ name: "Sample Junction", address: SAMPLE.address, pin_code: null, source: "ola", confirmed: false });
  });

  // T7 (story 1626): the result's own six-digit postal code is the pin; nearest_pin is not asked.
  test("T7: a tapped result with a postal code keeps it and does not ask nearest_pin", async ({ page, context }) => {
    const net = await openTap(page, context, SAMPLE_PIN);
    let nearCalls = 0;
    await context.route("**/rest/v1/rpc/nearest_pin**", async (r) => { nearCalls++; await r.fallback(); });
    await search(page).fill("samp");
    await places(page).getByRole("button").first().click();
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "POST").length).toBe(1);
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")[0].body).toMatchObject({ pin_code: "110016", source: "ola" });
    expect(nearCalls).toBe(0);
  });

  // T7b (story 1626): a result from our own table is source own.
  test("T7b: a tapped result from our own table is saved with source own", async ({ page, context }) => {
    const net = await openTap(page, context, SAMPLE_OWN);
    await search(page).fill("samp");
    await places(page).getByRole("button").first().click();
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "POST").length).toBe(1);
    expect(net.calls.recentWrites.filter((w) => w.method === "POST")[0].body).toMatchObject({ name: "Sample Junction", source: "own", pin_code: "110016" });
  });
}
