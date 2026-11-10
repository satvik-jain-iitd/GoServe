// Regression, screen 23: Placed and E2a (the order placed, cooking, the time it lands). Cases: .claude/handoff/qa/screens/23-Placed.md (epic #1196, story #1197).
// The cases that start at Place order reach the bill with the shared step and place the order with the fields bill.spec uses. The cases on a status reach the eta steps.
// Where the case needs data the shared step does not hold (a kitchen with its phone, the order on its next status), the test answers the same REST paths again on the page and then moves the app on (a later answer wins).
import { test, expect, type Locator, type Page, type Route } from "@playwright/test";
import { STEPS, NINE } from "../screensSteps";
import { ID, order } from "../helpers";

const PATH = "/customer/";
const PHONE = "9876543210";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const isPath = (path: string) => (url: URL) => url.pathname === path;
// Answers a request on the page (the browser's preflight too); the page's answer is used before the shared step's.
async function reply(route: Route, body: unknown) {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function answer(page: Page, path: string, body: unknown) {
  await page.route(isPath(path), (route) => reply(route, body));
}
// The kitchen with its phone, so the placed screen offers Call the kitchen.
const kitchen = (lat: number | null = null, lng: number | null = null) =>
  [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: PHONE, pin_codes: ["110016"], open: true, active: true, lat, lng, opens_at: "00:00:00", closes_at: "23:59:00" }];
// The app reads the order again when the phone comes back to the front.
const wake = (page: Page) => page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
// From the bill: the fields bill.spec fills, then Place order.
async function placeFromBill(page: Page) {
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill(PHONE);
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}
// The stamp sits in the order card (region Order); the timeline below repeats some of its words, so the stamp is found inside the card.
const stampOf = (page: Page, word: string) => page.getByRole("region", { name: "Order" }).getByText(word, { exact: true });
// The stamp's text colour as [red, green, blue], read from the page the way the Cancelled spec does.
const rgbOf = (loc: Locator) => loc.evaluate((el) => (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number));

test("TC 23.1 Look: right after Place order, the grey Placed stamp, Working out the time, the lines, the total, the note, the steps, Cancel and Call the kitchen", async ({ page, context }) => {
  await answer(page, "/rest/v1/kitchens", kitchen());
  await STEPS["bill"](context, page, PATH);
  await placeFromBill(page);
  const stamp = stampOf(page, "Placed");
  await expect(stamp).toBeVisible();   // proves the placed screen shows before the rest is checked
  const [r, g, b] = await rgbOf(stamp);
  expect(Math.max(r, g, b) - Math.min(r, g, b), `Placed stamp colour rgb(${r}, ${g}, ${b}) is grey`).toBeLessThan(30);   // grey: the three channels are close
  await expect(page.getByText("Working out the time")).toBeVisible();
  await expect(page.getByText("1 × Butter Chicken")).toBeVisible();
  await expect(page.getByText("Cash at door", { exact: true })).toBeVisible();
  await expect(page.getByText("₹320", { exact: true })).toBeVisible();
  await expect(page.getByText("The kitchen has your order. This page updates on its own.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Order progress" }).getByRole("listitem")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveAttribute("href", `tel:${PHONE}`);
});

test("TC 23.2 Look: the kitchen accepts, the yellow Cooking stamp, the big 25 min, By 9:25 am, the Live mark", async ({ page, context }) => {
  await page.clock.install({ time: NINE });   // the step's 25 minutes count from 9:00 am
  await STEPS["eta-big"](context, page, PATH);
  await expect(page.getByText("25 min", { exact: true })).toBeVisible();   // proves the big number shows before the rest is checked
  const stamp = stampOf(page, "Cooking");
  await expect(stamp).toBeVisible();
  const [r, g, b] = await rgbOf(stamp);
  test.fail(true, "#1267: the Cooking stamp is dark green, rgb(38, 53, 40), not yellow: its red does not lead blue");
  expect(r, `Cooking stamp colour rgb(${r}, ${g}, ${b}) is yellow`).toBeGreaterThan(b);   // yellow: red and green both above blue
  expect(g, `Cooking stamp colour rgb(${r}, ${g}, ${b}) is yellow`).toBeGreaterThan(b);
  await expect(page.getByText("By 9:25 am", { exact: true })).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
});

test("TC 23.3 Look: the late order says Running late, sorry under the stamp", async ({ page, context }) => {
  await STEPS["eta-late"](context, page, PATH);
  const stamp = stampOf(page, "On the way");
  const late = page.getByRole("status").filter({ hasText: "Running late, sorry" });
  await expect(stamp).toBeVisible();   // proves the screen shows before the position is checked
  await expect(late).toBeVisible();
  const s = (await stamp.boundingBox())!;
  const l = (await late.boundingBox())!;
  expect(l.y, "the late line sits under the stamp").toBeGreaterThanOrEqual(s.y + s.height);
});

test("TC 23.4 Happy: the kitchen hands it over, the status moves to On the way, the rider row opens the map", async ({ page, context }) => {
  await answer(page, "/rest/v1/kitchens", kitchen(28.57, 77.24));
  await STEPS["eta-working"](context, page, PATH);
  await expect(page.getByText("Working out the time")).toBeVisible();   // proves the cooking screen shows first
  await answer(page, "/rest/v1/orders", [order("out_for_delivery", new Date(Date.now() - 60_000).toISOString())]);
  await answer(page, "/rest/v1/order_tracking", [{ order_id: ID, status: "out_for_delivery", rider_lat: 28.5792, rider_lng: 77.26, eta_lo_min: 8, eta_hi_min: 18, eta_late: false, updated_at: new Date().toISOString() }]);
  await wake(page);
  await expect(stampOf(page, "On the way")).toBeVisible();
  const row = page.getByRole("button", { name: "See the rider on the map" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("region", { name: "Rider on the map" })).toBeVisible();
});

test("TC 23.5 Sad: Cancel order while placed asks first, then Cancelled with Nothing to pay Rs 0", async ({ page, context }) => {
  await answer(page, "/rest/v1/kitchens", kitchen());
  await STEPS["bill"](context, page, PATH);
  await placeFromBill(page);
  await answer(page, "/rest/v1/rpc/cancel_order", { ok: true, order: order("cancelled", new Date().toISOString()) });
  await page.getByRole("button", { name: "Cancel order" }).click();
  test.fail(true, "#1227: Cancel order cancels on one tap with no confirm sheet (the case expects Confirm first)");
  await expect(page.getByRole("dialog")).toBeVisible();   // Confirm: the app asks before it cancels
  await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cancelled", exact: true })).toBeVisible();
  await expect(page.getByText("Nothing to pay", { exact: true })).toBeVisible();
  await expect(page.getByText("₹0", { exact: true })).toBeVisible();
  await expect(page.getByText("Your order was cancelled. Nothing to pay.")).toBeVisible();
});

test("TC 23.8 Edge: close the app on this order and open it again, back on this order, live", async ({ page, context }) => {
  await STEPS["eta-working"](context, page, PATH);
  await expect(page.getByText("Working out the time")).toBeVisible();   // proves the order shows before the app is closed
  await page.reload();   // the app is closed and opened again
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  await expect(page.getByText("Working out the time")).toBeVisible();
  await expect(stampOf(page, "Cooking")).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
});

test("TC 23.9 Edge: the network is off for a minute, the page says it is offline, then catches up", async ({ page, context }) => {
  await STEPS["eta-working"](context, page, PATH);
  await expect(page.getByText("Working out the time")).toBeVisible();   // proves the order shows before the network goes
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: /offline|no connection/i })).toBeVisible();
  const word = page.locator(".ui-head").getByText("Offline", { exact: true });
  await expect(word).toBeVisible();
  const col = await word.evaluate((el) => getComputedStyle(el).color);
  const muted = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--gs-text-muted)"; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  expect(col).toBe(muted);   // the muted text colour, not the brand green of Live
  await expect(page.locator(".ui-head .ui-live-dot")).toHaveCount(0);   // no green dot while offline
  await context.setOffline(false);
  await answer(page, "/rest/v1/orders", [order("out_for_delivery", new Date(Date.now() - 60_000).toISOString())]);
  await wake(page);
  await expect(stampOf(page, "On the way")).toBeVisible();
});
