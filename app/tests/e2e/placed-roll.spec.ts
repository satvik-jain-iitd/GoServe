// Story 1324 (boards PL6, PL4, PL7, owner 13 Nov 2026: "only 3 states are visible ... the states slide up, and then the new state comes up", "PL4 final", "teen" for the two ends).
// The status list always shows three rows: the first step on top at the start (PL6), the step now in the middle (PL4), the step now at the bottom at the end (PL7).
// When the status changes the rows slide up one row (about 300 ms); the box never changes height, so the buttons never move and nothing scrolls at 360 by 640.
import { test, expect, type Page } from "@playwright/test";
import { setup, order, ID } from "./helpers";

const list = (page: Page) => page.getByRole("list", { name: "Order progress" });
const rows = (page: Page) => list(page).getByRole("listitem");
const now = (page: Page) => list(page).locator('[aria-current="step"]');
const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
// The app opens an order that is still on its way; a delivered order is reached live, the way a customer sees it.
async function openAt(context: Parameters<typeof setup>[0], page: Page, status: string) {
  const net = await setup(context, page, [order(status === "delivered" ? "out_for_delivery" : status)]);
  net.state.kitchens = KITCHEN;
  if (status === "out_for_delivery") { net.state.riderCard = { name: "Ravi", phone: "9876500000" }; net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, updated_at: new Date().toISOString() }; }   // story 1572: on the way, the one button is Call the rider, which needs a rider with a phone
  await page.goto("/customer/");
  if (status === "delivered") { await expect(now(page)).toHaveText("On the wayNow"); net.push("UPDATE", order("delivered", "2020-01-01T10:09:00Z")); await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible(); }
  return net;
}

test("R1 just placed: three rows, the first is the step now (PL6)", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(rows(page)).toHaveText(["PlacedNow", "Accepted", "Cooking"])   // story 1507: the step now says Now;
  await expect(rows(page).first()).toHaveAttribute("aria-current", "step");
});

test("R2 cooking: three rows, the middle one is the step now (PL4)", async ({ page, context }) => {
  await setup(context, page, [order("preparing")]);
  await page.goto("/customer/");
  await expect(rows(page)).toHaveText(["Accepted", "CookingNow", "Ready, rider picks up"]);
  await expect(rows(page).nth(1)).toHaveAttribute("aria-current", "step");
});

test("R3 delivered: three rows, the last is the step now (PL7)", async ({ page, context }) => {
  await openAt(context, page, "delivered");
  await expect(rows(page)).toHaveText(["Ready, rider picks up", "On the way", "Delivered"]);
  await expect(rows(page).last()).toHaveAttribute("aria-current", "step");
  const buttons = page.locator(".ui-bottom .ui-btn");
  await expect(buttons.last()).toHaveText(/Order again ›/);   // story 1434: the main button is last (story 1589: Order again on a delivered slip)
});

test("R4 the status changes: the rows slide up one row, the box keeps its height and the main button keeps its place", async ({ page, context }) => {
  const net = await openAt(context, page, "accepted");
  await expect(now(page)).toHaveText("AcceptedNow");
  const box0 = (await page.locator(".ui-roll").boundingBox())!;
  const btn0 = (await page.locator(".ui-bottom .ui-btn").last().boundingBox())!;
  net.push("UPDATE", order("preparing", "2020-01-01T10:02:00Z"));
  await expect(now(page)).toHaveText("CookingNow");
  const t = await list(page).evaluate((e) => getComputedStyle(e).transitionDuration);
  expect(t).toBe("0.3s");   // the slide
  await page.waitForTimeout(400);
  await expect(rows(page)).toHaveText(["Accepted", "CookingNow", "Ready, rider picks up"]);
  const box1 = (await page.locator(".ui-roll").boundingBox())!;
  const btn1 = (await page.locator(".ui-bottom .ui-btn").last().boundingBox())!;
  expect(box1.height).toBe(box0.height);
  expect(btn1.y).toBe(btn0.y);
});

test("R5 reduce motion: the rows change with no slide", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(context, page, [order("accepted")]);
  await page.goto("/customer/");
  await expect(now(page)).toHaveText("AcceptedNow");
  expect(await list(page).evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0s");
});

for (const status of ["placed", "preparing", "out_for_delivery", "delivered"]) {
  test(`R6 at 360 by 640, ${status}: the page does not scroll and every button is in view`, async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openAt(context, page, status);
    await expect(rows(page)).toHaveCount(3);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(false);
    for (const b of await page.locator(".ui-bottom .ui-btn").all()) expect((await b.boundingBox())!.y + (await b.boundingBox())!.height).toBeLessThanOrEqual(640);
  });
}

for (const status of ["placed", "preparing", "delivered"]) {
  test(`R9 at the board size 390 by 844, ${status}: the three rows end above the buttons and nothing scrolls inside the page`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAt(context, page, status);
    await expect(rows(page)).toHaveCount(3);
    await page.waitForTimeout(300);
    expect(await page.locator(".ui-scroll").evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
    const roll = (await page.locator(".ui-roll").boundingBox())!;
    const bar = (await page.locator(".ui-bottom").boundingBox())!;
    expect(roll.y + roll.height).toBeLessThanOrEqual(bar.y);
  });
}

// Review of PR 1466: at 360 by 640, just placed, the buttons cut the status box. The boards have no "kitchen has your order" line, so it goes and the rows get its room.
for (const status of ["placed", "preparing", "out_for_delivery"]) {
  test(`R10 at 360 by 640, ${status}: the status box ends above the buttons, with the pane at its end`, async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openAt(context, page, status);
    await expect(rows(page)).toHaveCount(3);
    await page.waitForTimeout(300);
    await page.locator(".ui-scroll").evaluate((e) => { e.scrollTop = e.scrollHeight; });   // story 1572: the buttons stack, so the inner pane may scroll; at its end the box is clear of the buttons
    const roll = (await page.locator(".ui-roll").boundingBox())!;
    const bar = (await page.locator(".ui-bottom .ui-btn").first().boundingBox())!;   // the first button's top, as the review measured
    expect(roll.y + roll.height).toBeLessThanOrEqual(bar.y);
  });
}

test("R8 the two outline buttons stack, Cancel above Call the kitchen, same left and width (story 1572, owner pick B)", async ({ page, context }) => {
  await openAt(context, page, "accepted");
  const cancel = (await page.getByRole("button", { name: "Cancel order" }).boundingBox())!;
  const call = (await page.getByRole("link", { name: "Call the kitchen" }).boundingBox())!;
  expect(cancel.y + cancel.height).toBeLessThanOrEqual(call.y);
  expect(Math.abs(cancel.x - call.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(cancel.width - call.width)).toBeLessThanOrEqual(1);
});

test("R8b delivered: Order again (story 1589; before: Back to menu) is the one button, full width, with no Call the kitchen (story 1656)", async ({ page, context }) => {
  await openAt(context, page, "delivered");
  await expect(page.locator(".ui-bottom > .ui-btn")).toHaveCount(1);
  const col = (await page.locator(".ui-bottom").boundingBox())!;
  const main = (await page.locator(".ui-bottom .ui-btn").last().boundingBox())!;
  expect(main.width).toBeGreaterThan(col.width - 48);
});

// Story 1656: Call the kitchen shows only while the kitchen holds the order (placed, accepted, preparing, ready).
const callKitchen = (page: Page) => page.getByRole("link", { name: "Call the kitchen" });
for (const [id, status, label] of [["K1", "placed", "just placed"], ["K2c", "accepted", "accepted"], ["K2b", "preparing", "cooking"], ["K2", "ready", "ready"]]) {
  test(`${id} Given an order that is ${label}, then Call the kitchen is shown`, async ({ page, context }) => {
    await openAt(context, page, status);
    await expect(callKitchen(page)).toHaveAttribute("href", "tel:9876543210");
  });
}
test("K3 Given an order out for delivery, then Call the kitchen is not shown", async ({ page, context }) => {
  await openAt(context, page, "out_for_delivery");
  await expect(page.getByRole("link", { name: "Call the rider" })).toBeVisible();
  await expect(callKitchen(page)).toHaveCount(0);
});
test("K4 Given a delivered order, then Call the kitchen is not shown", async ({ page, context }) => {
  await openAt(context, page, "delivered");
  await expect(callKitchen(page)).toHaveCount(0);
});
test("K5 Given a cancelled order, then Call the kitchen is not shown", async ({ page, context }) => {
  const net = await openAt(context, page, "placed");
  await expect(callKitchen(page)).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled")).toBeVisible();
  await expect(callKitchen(page)).toHaveCount(0);
});
test("K5b Given a declined order, then Call the kitchen is not shown", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancel_reason: "We are out of butter chicken tonight, so this order cannot be made." }]);
  net.state.kitchens = KITCHEN;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Declined" })).toBeVisible();
  await expect(callKitchen(page)).toHaveCount(0);
});

// Story 1650: the rider is at the door, so the second row says "Rider at your door"; the last row says "Delivered", never "At your door" again.
test("R11 rider at the door: the rows read Ready, Rider at your door, Delivered and no row says At your door", async ({ page, context }) => {
  const net = await openAt(context, page, "out_for_delivery");
  const arriving = { id: "e1", order_id: ID, event: "order.arriving" };
  net.state.events = [arriving];
  net.push("INSERT", arriving, "order_events");
  await expect(rows(page)).toHaveText(["Ready, rider picks up", "Rider at your doorNow", "Delivered"]);
  await expect(list(page).getByText("At your door", { exact: true })).toHaveCount(0);
});

test("R7 no step count and no Ping me button", async ({ page, context }) => {
  await setup(context, page, [order("preparing")]);
  await page.goto("/customer/");
  await expect(now(page)).toHaveText("CookingNow");
  await expect(page.getByText(/\d of 6/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ping me/ })).toHaveCount(0);
});
