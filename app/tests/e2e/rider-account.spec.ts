// Story A5 (#152): the rider app. A rider goes online, shares a location while online, and sees only the orders assigned to them.
import { test, expect } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

test("S1 an offline rider goes online, and offline again", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();   // H11: R4
  expect(net.calls.riderWrites.find((w) => w.body.online === true)).toBeTruthy();
  await page.getByRole("button", { name: "Go offline" }).click();
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  expect(net.calls.riderWrites.at(-1)!.body.online).toBe(false);
});

test("S2 an account that is not a rider says so and shows no deliveries", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.rider = null;
  net.state.anonymous = false;
  await page.goto("/rider/");
  await expect(page.getByText("This Google account is not on the rider list")).toBeVisible();   // H11: R2
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toHaveCount(0);
});

test("S3 the rider app reads the orders assigned to this rider, not a session or a kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION }]);
  await page.goto("/rider/");
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeVisible();
  expect(net.calls.orderReads.some((u) => u.includes(`rider_id=eq.${SESSION}`))).toBe(true);
  expect(net.calls.orderReads.some((u) => u.includes("session_id=eq.") || u.includes("kitchen_id=eq."))).toBe(false);
  void ID;
});

test("S4 while online the rider's location is sent, first at once", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5494, longitude: 77.2001 });
  const net = await setup(context, page);
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  await expect.poll(() => net.calls.rpc.some((c) => c.name === "rider_ping")).toBe(true);   // H14: the history is kept by the rider_ping function
  expect(net.calls.rpc.find((c) => c.name === "rider_ping")!.body).toEqual({ p_lat: 28.5494, p_lng: 77.2001 });
  expect(net.calls.riderWrites.filter((w) => w.body.lat !== undefined)).toHaveLength(0);
});

test("S5 an offline rider sends no location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5, longitude: 77.2 });
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(net.calls.riderWrites.filter((w) => w.body.lat !== undefined)).toHaveLength(0);
  expect(net.calls.rpc.filter((c) => c.name === "rider_ping")).toHaveLength(0);
});
