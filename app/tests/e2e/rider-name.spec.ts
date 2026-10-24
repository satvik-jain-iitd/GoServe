// Story #231 (F149): the ready ticket names the rider who is coming, and the minutes away when the rider's location is fresh.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const READY = { ...order("ready"), rider_id: "r-9" };
const AMIT = { user_id: "r-9", name: "Amit Kumar", phone: null, online: true, lat: 28.5494, lng: 77.2001, updated_at: new Date().toISOString() };   // about 1.1 km from the kitchen

test("S1 a ready ticket with a rider says who is coming, and how many minutes when the location is fresh", async ({ page, context }) => {
  const net = await setup(context, page, [READY]);
  net.state.kitchen = "k-1";
  Object.assign(net.state.kitchens[0], { lat: 28.5535, lng: 77.1935 });
  net.state.riders = [AMIT];
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  const ticket = page.locator(".ui-ticket", { hasText: "No. 0f0f0f0f" });
  await expect(ticket).toContainText("Amit Kumar");
  await expect(ticket).toContainText(/Amit Kumar · \d+ min/);
  await expect(ticket).not.toContainText("Rider on the way");
});

test("S1 a stale location gives the name only; no rider yet keeps Rider on the way", async ({ page, context }) => {
  const net = await setup(context, page, [READY, { ...order("ready"), id: "0c0c0c0c-0000-0000-0000-000000000000" }]);
  net.state.kitchen = "k-1";
  Object.assign(net.state.kitchens[0], { lat: 28.5535, lng: 77.1935 });
  net.state.riders = [{ ...AMIT, updated_at: new Date(Date.now() - 30 * 60_000).toISOString() }];   // half an hour old
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  const named = page.locator(".ui-ticket", { hasText: "No. 0f0f0f0f" });
  await expect(named).toContainText("Amit Kumar");
  await expect(named).not.toContainText(/\d+ min/);
  await expect(page.locator(".ui-ticket", { hasText: "No. 0c0c0c0c" })).toContainText("Rider on the way");
});
