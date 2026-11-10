// Story #1280 (board A13-KitchenOff): a kitchen that is off shows in City with an Off tag, and the admin can turn it back on. It comes back closed for orders, so no order reaches a kitchen with no staff.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan } from "./helpers";

const OFF = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: false, active: false, opens_at: "11:00:00", closes_at: "22:00:00" };
const LOG = [{ kitchen_id: "k-1", active: false, by_label: "satvik@goserve.test", at: "2026-11-09T07:30:00Z" }];
const admin = async (page: Page, context: Parameters<typeof setup>[0], over: Record<string, unknown> = {}) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = [OFF];
  net.state.offLog = LOG;
  Object.assign(net.state, over);
  return net;
};
const toPage = async (page: Page) => {
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await expect(page.getByRole("heading", { name: "Tau Ka Dhaba" })).toBeVisible();
};
const turnOns = (net: Awaited<ReturnType<typeof setup>>) => net.calls.rpc.filter((r) => r.name === "kitchen_turn_on");

test("S1 City lists a kitchen that is off, with an Off tag; it is not hidden", async ({ page, context }) => {
  await admin(page, context);
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ })).toContainText("Off");
});

test("S2 an off kitchen's page: the Off tag, the one line, Staff 0 with its line, Call above Turn kitchen back on", async ({ page, context }) => {
  await admin(page, context);
  await toPage(page);
  await expect(page.locator(".ui-head .ui-tag")).toHaveText("Off");
  await expect(page.getByText(/^This kitchen is off\. Customers cannot see it or order from it\. Turned off by satvik@goserve\.test, /)).toBeVisible();
  await expect(page.getByText("Staff were taken off when this kitchen was turned off. Add them again after you turn it on.")).toBeVisible();
  const call = page.getByRole("link", { name: "Call Tau Ka Dhaba" }), on = page.getByRole("button", { name: "Turn kitchen back on" });
  await expect(call).toBeVisible(); await expect(on).toBeVisible();
  expect((await call.boundingBox())!.y).toBeLessThan((await on.boundingBox())!.y);   // the filled button is last
  expect(await scan(page)).toEqual([]);
});

test("S3 Turn kitchen back on sends one call; the tag is no longer Off; the kitchen is still closed for orders; the normal page shows", async ({ page, context }) => {
  const net = await admin(page, context);
  await toPage(page);
  await page.getByRole("button", { name: "Turn kitchen back on" }).click();
  await expect(page.locator(".ui-head .ui-tag")).toHaveText("Closed");   // active again, not open
  await expect(page.getByRole("region", { name: "Leaving GoServe" })).toBeVisible();   // the normal kitchen page
  await expect(page.getByRole("button", { name: "Turn kitchen back on" })).toHaveCount(0);
  expect(turnOns(net)).toHaveLength(1);
  expect(turnOns(net)[0].body).toEqual({ p_kitchen: "k-1" });
  expect((net.state.kitchens as { open: boolean }[])[0].open).toBe(false);
});

test("S4 when the call fails an error line shows and the kitchen stays Off", async ({ page, context }) => {
  const net = await admin(page, context, { turnOnStatus: 500 });
  await toPage(page);
  await page.getByRole("button", { name: "Turn kitchen back on" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not turn the kitchen on");
  await expect(page.locator(".ui-head .ui-tag")).toHaveText("Off");
  await expect(page.getByRole("button", { name: "Turn kitchen back on" })).toBeEnabled();   // the admin can try again
  expect(turnOns(net)).toHaveLength(1);
});

test("S5 two fast taps send one call", async ({ page, context }) => {
  const net = await admin(page, context, { turnOnDelayMs: 600 });
  await toPage(page);
  const on = page.getByRole("button", { name: "Turn kitchen back on" });
  await on.dblclick();
  await expect(page.locator(".ui-head .ui-tag")).toHaveText("Closed");
  expect(turnOns(net)).toHaveLength(1);
});

test("S6 with no record of who turned it off the line still stands, without a name", async ({ page, context }) => {
  await admin(page, context, { offLog: [] });
  await toPage(page);
  await expect(page.getByText("This kitchen is off. Customers cannot see it or order from it.", { exact: true })).toBeVisible();
});
