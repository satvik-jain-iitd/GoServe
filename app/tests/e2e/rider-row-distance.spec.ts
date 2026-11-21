// Story 1744 (owner, 20 Nov 2026): the rider row says the distance only, with no rider name and no minutes, and has one height for every rider.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const SEEN = new Date(2026, 9, 29, 20, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const row = (page: Page) => page.getByRole("link", { name: "See the rider on Google Maps" });
const title = (page: Page) => row(page).locator(".ui-locrow-title");

async function onTheWay(page: Page, context: BrowserContext, name = "Ravi", tracking: object = {}) {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name, phone: "9876500000" };
  net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: iso(SEEN.getTime()), rider_at: iso(SEEN.getTime() - 20_000), drop_lat: 28.598, drop_lng: 77.25, ...tracking };
  await page.clock.setFixedTime(SEEN);
  await page.goto("/customer/");
  await expect(row(page)).toBeVisible();
  return net;
}

test("AC-1 the title says Rider is 2.0 km away, with no name and no minutes", async ({ page, context }) => {
  await onTheWay(page, context);
  await expect(title(page)).toHaveText("Rider is 2.0 km away");
  await expect(row(page)).not.toContainText("Ravi");
  await expect(row(page)).not.toContainText("min away");
});

test("AC-1 under 1 km the distance is in metres: Rider is 890 m away", async ({ page, context }) => {
  await onTheWay(page, context, "Ravi", { rider_lat: 28.59 });
  await expect(title(page)).toHaveText("Rider is 890 m away");
});

test("AC-1 no position on the order keeps the title as it was: no new text", async ({ page, context }) => {
  await onTheWay(page, context, "Ravi", { drop_lat: null, drop_lng: null });
  await expect(title(page)).toHaveText("Ravi is on the way");
});

test("AC-2 the sub line says updated 20 sec ago, without On the map; offline it says No connection · Last seen", async ({ page, context }) => {
  await onTheWay(page, context);
  await expect(row(page)).toContainText("updated 20 sec ago");
  await expect(row(page)).not.toContainText("On the map");
  await context.setOffline(true);
  await expect(row(page)).toContainText("No connection · Last seen");
});

for (const size of SIZES) {
  test(`AC-3 at ${size.width} by ${size.height} the row has the same height for a 4-letter and a 26-letter name, and the title is one line`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await onTheWay(page, context, "Ravi");
    const short = (await row(page).boundingBox())!;
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const net = await onTheWay(page, context, "Abcdefghijklmnopqrstuvwxyz");
    const long = (await row(page).boundingBox())!;
    expect(long.height).toBe(short.height);
    expect(long.width).toBe(short.width);
    // the no-position title keeps the name, so a long name must not make it a second line
    net.state.tracking = { ...net.state.tracking!, drop_lat: null, drop_lng: null };
    await page.reload();
    await expect(title(page)).toHaveText("Abcdefghijklmnopqrstuvwxyz is on the way");
    expect((await row(page).boundingBox())!.height).toBe(short.height);
  });
}

test("AC-4 the row is still the link to Google Maps with the route", async ({ page, context }) => {
  await onTheWay(page, context);
  const href = new URL((await row(page).getAttribute("href"))!);
  expect(href.origin + href.pathname).toBe("https://www.google.com/maps/dir/");
  expect(href.searchParams.get("origin")).toBe("28.58,77.25");
  await expect(row(page)).toHaveAttribute("target", "_blank");
});
