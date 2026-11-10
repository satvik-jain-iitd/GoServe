// Regression, screen 28: T4 and T5 Rider on the way, rider row and rider map. Cases: .claude/handoff/qa/screens/28-T4-T5.md (epic #1196). Reached with the shared steps STEPS["tracker-rider-row"] (the row) and the tap on it (the map).
// The clock is fixed at NINE, the time the shared steps were written for, so "updated 20 sec ago" and the door time are exact.
import { test, expect, type Page } from "@playwright/test";
import { STEPS, NINE } from "../screensSteps";

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

test("TC 28.3 The phone loses its connection while the order is on the way: the row says No connection and when the rider was last seen", async ({ page, context }) => {
  await page.clock.setFixedTime(NINE);
  await STEPS["tracker-rider-row"](context, page, PATH);
  await expect(row(page)).toContainText("Rahul is 1.2 km away");   // proves the row is live before the phone goes offline
  await context.setOffline(true);
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
