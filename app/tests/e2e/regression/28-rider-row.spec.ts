// Regression, screen 28: T4 and T5 Rider on the way, rider row and rider map. Cases: .claude/handoff/qa/screens/28-T4-T5.md (epic #1196). Reached with the shared steps STEPS["tracker-rider-row"] (the row) and the tap on it (the map).
// The clock is fixed at NINE, the time the shared steps were written for, so "updated 20 sec ago" and the door time are exact.
import { test, expect, type Page } from "@playwright/test";
import { STEPS, NINE } from "../screensSteps";
import { ID } from "../helpers";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const row = (page: Page) => page.getByRole("button", { name: "See the rider on the map" });
const map = (page: Page) => page.getByRole("region", { name: "Rider on the map" });
const slip = (page: Page) => page.getByRole("region", { name: "Order", exact: true });

test("TC 28.1 Order on the way: the On the way stamp, minutes, By time, the rider row with its words, the steps, Call the rider", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  await expect(slip(page).getByText("On the way", { exact: true })).toBeVisible();   // proves the on-the-way order shows before the rest is checked
  await expect(slip(page).getByText(/^\d+ min$/)).toBeVisible();
  await expect(slip(page).getByText(/^By \d{1,2}:\d{2} (am|pm)$/)).toBeVisible();
  await expect(row(page)).toContainText("Rahul is 1.2 km away");
  await expect(row(page)).toContainText("On the map · updated 20 sec ago");
  await expect(page.getByRole("list", { name: "Order progress" }).getByRole("listitem").filter({ hasText: "On the way" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("link", { name: "Call the rider" })).toHaveAttribute("href", "tel:9876543210");
  await expect(map(page)).toHaveCount(0);   // no map in the page until the row is tapped
});

test("TC 28.2 Tap the rider row: the full map with Home and the rider, dashed route, Live, the order card, Call the rider", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  await expect(row(page)).toContainText("Rahul is 1.2 km away");   // proves the row shows before the tap
  await expect(map(page)).toHaveCount(0);
  await row(page).click();
  const m = map(page);
  await expect(m).toBeVisible();
  const box = await m.boundingBox();
  const vp = page.viewportSize()!;
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([vp.width, vp.height]);   // the full screen
  await expect(m.getByRole("img", { name: "Home" })).toBeVisible();
  await expect(m.getByRole("img", { name: "Rider" })).toContainText("Rahul");
  await expect(m.locator("path.gs-route")).toHaveAttribute("stroke-dasharray", "6 6");
  await expect(m.getByText("Live", { exact: true })).toBeVisible();
  await expect(m.getByText("Rahul is 1.2 km away")).toBeVisible();
  await expect(m.getByText(/^At your door by \d{1,2}:\d{2} (am|pm) · updated 20 sec ago$/)).toBeVisible();
  await expect(m.getByRole("link", { name: "Call the rider" })).toHaveAttribute("href", "tel:9876543210");
});

test("TC 28.3 Rider location older than 2 min: the row says No connection and when the rider was last seen", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  // The rider's last ping is 3 minutes old while the phone is online: a later route answer wins over the shared step's.
  await context.route(
    (url) => url.hostname === "test.supabase.co" && url.pathname === "/rest/v1/order_tracking",
    (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify([{ order_id: ID, status: "out_for_delivery", rider_lat: 28.5792, rider_lng: 77.26, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: new Date(NINE.getTime() - 180_000).toISOString() }]) }),
  );
  await page.reload();
  await expect(row(page)).toContainText("Rahul is 1.2 km away");   // proves the row is live with the older ping
  await expect(row(page)).toContainText("On the map · updated 3 min ago");   // the stale time shows, the words are the app's own
  test.fail(true, "#1230: the row says On the map · updated 3 min ago while online: No connection shows only when the phone is offline, never because the rider's ping is old");
  await expect(row(page)).toContainText("No connection · Last seen");
});

test("TC 28.5 Map tiles fail: the plain map still shows Home and the rider", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  let tilesFailed = 0;
  await context.route("https://tiles.test/**", (route) => { tilesFailed++; return route.abort(); });   // a later route wins: every tile fails
  await page.reload();
  await expect(row(page)).toContainText("Rahul is 1.2 km away");
  await row(page).click();
  const m = map(page);
  await expect(m).toBeVisible();
  await expect.poll(() => tilesFailed).toBeGreaterThan(0);   // the tiles were asked for and refused
  await expect(m.getByRole("img", { name: "Home" })).toBeVisible();
  await expect(m.getByRole("img", { name: "Rider" })).toContainText("Rahul");
  await expect(m.getByText("Rahul is 1.2 km away")).toBeVisible();
});
