// Story #1015 (boards E2a, E1b, E1c): the delivery time is the server's. One big number of minutes with the clock it lands on; "Running late, sorry"; "Working out the time".
// It moves without a reload when the tracking row changes. Never a fixed number the server did not give.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const NOW = new Date(2026, 10, 8, 19, 47, 0);   // 7:47 pm on the phone's clock
const row = (lo: number | null, late = false, ago = 0) => ({ rider_lat: null, rider_lng: null, eta_lo_min: lo, eta_hi_min: lo === null ? null : lo + 10, eta_late: late, updated_at: new Date(NOW.getTime() - ago * 1000).toISOString() });

test("S1 cooking: one big number and the clock it lands on, from the server", async ({ page, context }) => {
  const net = await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  net.state.tracking = row(25);
  await page.clock.setFixedTime(NOW);
  await page.goto("/customer/");
  await expect(page.getByText("25 min", { exact: true })).toBeVisible();
  await expect(page.getByText("By 8:12 pm")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("About 20 min");
});

test("S2 a new row over realtime changes the number without a reload", async ({ page, context }) => {
  const net = await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  net.state.tracking = row(25);
  await page.clock.setFixedTime(NOW);
  await page.goto("/customer/");
  await expect(page.getByText("25 min", { exact: true })).toBeVisible();
  net.state.tracking = row(12);
  net.push("UPDATE", { order_id: "x", ...net.state.tracking }, "order_tracking");
  await expect(page.getByText("12 min", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("By 7:59 pm")).toBeVisible();
});

test("S3 past the promise the line says running late", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.tracking = row(8, true);
  await page.clock.setFixedTime(NOW);
  await page.goto("/customer/");
  await expect(page.getByText("Running late, sorry")).toBeVisible();
  await expect(page.getByText("8 min", { exact: true })).toHaveCount(0);
});

test("S4 no number from the server yet: working it out, never a fixed 20", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.tracking = row(null);
  await page.goto("/customer/");
  await expect(page.getByText("Working out the time")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("20 min");
});

test("S5 no tracking row at all: working it out", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByText("Working out the time")).toBeVisible();
});

test("S6 once the order is cancelled the time line is gone", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.tracking = row(25);
  await page.clock.setFixedTime(NOW);
  await page.goto("/customer/");
  await expect(page.getByText("25 min", { exact: true })).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled. Nothing to pay.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("25 min", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Working out the time")).toHaveCount(0);
});
