// Story 1498 (boards RL1 and AM1, canvas row 2ci): how the customer sees the rider is the admin's choice: Google Maps link (the start value), Live map in the app, Off.
// RL1: "See <rider> on Google Maps" with "Last updated <clock time>": the time of the rider's last ping. An old place is not hidden; the time tells the truth.
// AM1: admin Numbers, a "Maps" block with three radio rows in the board's order, and "Last changed by".
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const SEEN = new Date(2026, 9, 29, 20, 4, 30);   // 8:04 pm on the phone's own clock
const iso = (ms: number) => new Date(ms).toISOString();
const link = (page: Page) => page.getByRole("link", { name: /^See Ravi on Google Maps/ });
const mapRow = (page: Page) => page.getByRole("button", { name: "See the rider on the map" });

async function onTheWay(page: Page, context: BrowserContext, mode: "off" | "link" | "map", tracking: object | null = {}) {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  net.state.riderMode = mode;
  if (tracking) net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: iso(SEEN.getTime()), rider_at: iso(SEEN.getTime() - 20_000), drop_lat: 28.598, drop_lng: 77.25, ...tracking };
  await page.clock.setFixedTime(SEEN);
  return net;
}

test("RL1a given the mode is link and a rider place is known, the row says See Ravi on Google Maps with the clock time of the place, and opens Google Maps from the rider to the order's door", async ({ page, context }) => {
  await onTheWay(page, context, "link");
  await page.goto("/customer/");
  await expect(link(page)).toContainText("Last updated 8:04 pm");
  const href = new URL((await link(page).getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://www.google.com/maps/dir/");
  expect([href.searchParams.get("api"), href.searchParams.get("origin"), href.searchParams.get("destination"), href.searchParams.get("travelmode")]).toEqual(["1", "28.58,77.25", "28.598,77.25", "two-wheeler"]);
  await expect(link(page)).toHaveAttribute("target", "_blank");
  await expect(mapRow(page)).toHaveCount(0);
  await expect(page.getByText("Live", { exact: true })).toHaveCount(0);   // board RL1: no Live mark anywhere
});

test("RL1b given the place was sent 14 minutes ago, the row still shows and says that clock time", async ({ page, context }) => {
  await onTheWay(page, context, "link", { rider_at: iso(SEEN.getTime() - 14 * 60_000) });
  await page.goto("/customer/");
  await expect(link(page)).toContainText("Last updated 7:50 pm");
});

test("RL1c given no rider place is known, the row is not shown; the rider card with its call link stays", async ({ page, context }) => {
  await onTheWay(page, context, "link", null);
  await page.goto("/customer/");
  await expect(page.getByRole("link", { name: /Call/ })).toBeVisible();
  await expect(link(page)).toHaveCount(0);
});

test("RL1d given the order has no drop point, the link opens Google Maps at the rider's place alone", async ({ page, context }) => {
  await onTheWay(page, context, "link", { drop_lat: null, drop_lng: null });
  await page.goto("/customer/");
  const href = new URL((await link(page).getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://www.google.com/maps/search/");
  expect(href.searchParams.get("query")).toBe("28.58,77.25");
});

test("RL1e a tap on the row is counted with the order and the mode, and no place", async ({ page, context }) => {
  const net = await onTheWay(page, context, "link");
  await page.goto("/customer/");
  await link(page).evaluate((a: HTMLAnchorElement) => a.addEventListener("click", (e) => e.preventDefault()));   // stay on the page
  await link(page).click();
  await expect.poll(() => net.state.riderRowTaps.length).toBe(1);
  expect(Object.keys(net.state.riderRowTaps[0]).sort()).toEqual(["p_mode", "p_order"]);
  expect((net.state.riderRowTaps[0] as { p_mode: string }).p_mode).toBe("link");
});

test("RL1f given the mode is map, the screen is board T4 as today: the rider row that opens the live map", async ({ page, context }) => {
  await onTheWay(page, context, "map");
  await page.goto("/customer/");
  await expect(mapRow(page)).toContainText("Ravi is 2.0 km away");
  await expect(link(page)).toHaveCount(0);
});

test("RL1g given the mode is off, there is no row and no map; Call stays", async ({ page, context }) => {
  await onTheWay(page, context, "off");
  await page.goto("/customer/");
  await expect(page.getByRole("link", { name: /Call/ })).toBeVisible();
  await expect(link(page)).toHaveCount(0);
  await expect(mapRow(page)).toHaveCount(0);
});

test("RL1h given the admin changes the mode, an open customer app follows it without a reload", async ({ page, context }) => {
  const net = await onTheWay(page, context, "link");
  await page.goto("/customer/");
  await expect(link(page)).toBeVisible();
  net.state.riderMode = "off";
  // The mock sends an event to every channel on `settings` that has settled; the phone code channel joins first, so the event is sent again until this one hears it.
  await expect(async () => {
    net.push("UPDATE", { name: "rider_location_mode", value: { mode: "off" } }, "settings");
    await expect(link(page)).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
});

test("RL1i given the setting cannot be read, the app uses the start value: the Google Maps link", async ({ page, context }) => {
  const net = await onTheWay(page, context, "map");
  net.state.riderModeDown = true;
  await page.goto("/customer/");
  await expect(link(page)).toBeVisible();
});

test("AM1a the Maps block: three choices in the board's order, the saved one is marked, one tap saves, and Last changed by follows", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.riderMode = "link";
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  const block = page.getByRole("region", { name: "Maps" });
  await expect(block.getByText("Admin only")).toBeVisible();
  await expect(block.getByRole("radiogroup", { name: "How the customer sees the rider" })).toBeVisible();
  await expect(block.getByText("On the order screen, while the order is on the way")).toBeVisible();
  const rows = block.getByRole("radio");
  await expect(rows).toHaveCount(3);
  expect(await block.locator("label").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " ").trim()))).toEqual([
    "Google Maps link The rider's last place, with its time", "Live map in the app A dot that moves while the rider app is open", "Off The minutes, the status and Call only"]);
  await expect(rows.nth(0)).toBeChecked();
  await expect(block.getByText(/^Last changed by owner@goserve\.test, 14 Nov/)).toBeVisible();
  await rows.nth(2).check();
  await expect(rows.nth(2)).toBeChecked();
  expect(net.state.riderModeSets).toEqual(["off"]);
  await expect(block.getByText(/^Last changed by you, /)).toBeVisible();
});

test("AM1b a failed save puts the mark back where the server holds it and says so", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.riderMode = "link";
  await context.route("**/rest/v1/rpc/rider_location_mode_set_v2", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) }));
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  const block = page.getByRole("region", { name: "Maps" });
  await block.getByRole("radio").nth(1).click();
  await expect(block.getByRole("alert")).toContainText("Could not save. Try again.");
  await expect(block.getByRole("radio").nth(0)).toBeChecked();
});
