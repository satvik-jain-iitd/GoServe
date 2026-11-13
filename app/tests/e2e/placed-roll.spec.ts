// Story 1324 (boards PL6, PL4, PL7, owner 13 Nov 2026: "only 3 states are visible ... the states slide up, and then the new state comes up", "PL4 final", "teen" for the two ends).
// The status list always shows three rows: the first step on top at the start (PL6), the step now in the middle (PL4), the step now at the bottom at the end (PL7).
// When the status changes the rows slide up one row (about 300 ms); the box never changes height, so the buttons never move and nothing scrolls at 360 by 640.
import { test, expect, type Page } from "@playwright/test";
import { setup, order } from "./helpers";

const list = (page: Page) => page.getByRole("list", { name: "Order progress" });
const rows = (page: Page) => list(page).getByRole("listitem");
const now = (page: Page) => list(page).locator('[aria-current="step"]');
const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
// The app opens an order that is still on its way; a delivered order is reached live, the way a customer sees it.
async function openAt(context: Parameters<typeof setup>[0], page: Page, status: string) {
  const net = await setup(context, page, [order(status === "delivered" ? "out_for_delivery" : status)]);
  net.state.kitchens = KITCHEN;
  await page.goto("/customer/");
  if (status === "delivered") { await expect(now(page)).toHaveText("On the way"); net.push("UPDATE", order("delivered", "2020-01-01T10:09:00Z")); await expect(page.getByRole("heading", { name: "Delivered" })).toBeVisible(); }
  return net;
}

test("R1 just placed: three rows, the first is the step now (PL6)", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(rows(page)).toHaveText(["Placed", "Accepted", "Cooking"]);
  await expect(rows(page).first()).toHaveAttribute("aria-current", "step");
});

test("R2 cooking: three rows, the middle one is the step now (PL4)", async ({ page, context }) => {
  await setup(context, page, [order("preparing")]);
  await page.goto("/customer/");
  await expect(rows(page)).toHaveText(["Accepted", "Cooking", "Ready, rider picks up"]);
  await expect(rows(page).nth(1)).toHaveAttribute("aria-current", "step");
});

test("R3 delivered: three rows, the last is the step now (PL7)", async ({ page, context }) => {
  await openAt(context, page, "delivered");
  await expect(rows(page)).toHaveText(["Ready, rider picks up", "On the way", "At your door"]);
  await expect(rows(page).last()).toHaveAttribute("aria-current", "step");
  const buttons = page.locator(".ui-bottom .ui-btn");
  await expect(buttons.last()).toHaveText("Back to menu");   // story 1434: the main button is last
});

test("R4 the status changes: the rows slide up one row, the box keeps its height and the main button keeps its place", async ({ page, context }) => {
  const net = await openAt(context, page, "accepted");
  await expect(now(page)).toHaveText("Accepted");
  const box0 = (await page.locator(".ui-roll").boundingBox())!;
  const btn0 = (await page.locator(".ui-bottom .ui-btn").last().boundingBox())!;
  net.push("UPDATE", order("preparing", "2020-01-01T10:02:00Z"));
  await expect(now(page)).toHaveText("Cooking");
  const t = await list(page).evaluate((e) => getComputedStyle(e).transitionDuration);
  expect(t).toBe("0.3s");   // the slide
  await page.waitForTimeout(400);
  await expect(rows(page)).toHaveText(["Accepted", "Cooking", "Ready, rider picks up"]);
  const box1 = (await page.locator(".ui-roll").boundingBox())!;
  const btn1 = (await page.locator(".ui-bottom .ui-btn").last().boundingBox())!;
  expect(box1.height).toBe(box0.height);
  expect(btn1.y).toBe(btn0.y);
});

test("R5 reduce motion: the rows change with no slide", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(context, page, [order("accepted")]);
  await page.goto("/customer/");
  await expect(now(page)).toHaveText("Accepted");
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

test("R8 two outline buttons share one line, Cancel on the left (board PL4); a main button stays last and full width (story 1434)", async ({ page, context }) => {
  await openAt(context, page, "accepted");
  const cancel = (await page.getByRole("button", { name: "Cancel order" }).boundingBox())!;
  const call = (await page.getByRole("link", { name: "Call the kitchen" }).boundingBox())!;
  expect(Math.abs(cancel.y - call.y)).toBeLessThanOrEqual(1);
  expect(cancel.x).toBeLessThan(call.x);
});

test("R8b delivered: Back to menu stays full width under Call the kitchen (story 1434)", async ({ page, context }) => {
  await openAt(context, page, "delivered");
  await expect(page.locator(".ui-bottom > *")).toHaveCount(2);
  const call = (await page.getByRole("link", { name: "Call the kitchen" }).boundingBox())!;
  const main = (await page.locator(".ui-bottom").getByRole("button", { name: "Back to menu" }).boundingBox())!;
  expect(call.y + call.height).toBeLessThanOrEqual(main.y);
  expect(Math.abs(call.width - main.width)).toBeLessThanOrEqual(1);
});

test("R7 no step count and no Ping me button", async ({ page, context }) => {
  await setup(context, page, [order("preparing")]);
  await page.goto("/customer/");
  await expect(now(page)).toHaveText("Cooking");
  await expect(page.getByText(/\d of 6/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ping me/ })).toHaveCount(0);
});
