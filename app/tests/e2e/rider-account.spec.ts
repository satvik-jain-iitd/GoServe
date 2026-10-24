// Story A5 (#152): the rider app. A rider goes online, shares a location while online, and sees only the orders assigned to them.
import { test, expect } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

test("S1 an offline rider goes online, and offline again", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByText("You are offline")).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByText("You are online")).toBeVisible();
  expect(net.calls.riderWrites.find((w) => w.body.online === true)).toBeTruthy();
  await page.getByRole("button", { name: "Go offline" }).click();
  await expect(page.getByText("You are offline")).toBeVisible();
  expect(net.calls.riderWrites.at(-1)!.body.online).toBe(false);
});

test("S2 an account that is not a rider says so and shows no deliveries", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.rider = null;
  await page.goto("/rider/");
  await expect(page.getByText("This account is not a rider")).toBeVisible();
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
  await expect(page.getByText("You are online")).toBeVisible();
  await expect.poll(() => net.calls.riderWrites.some((w) => w.body.lat !== undefined)).toBe(true);
  const w = net.calls.riderWrites.find((x) => x.body.lat !== undefined)!;
  expect(w.body).toMatchObject({ lat: 28.5494, lng: 77.2001 });
});

test("S5 an offline rider sends no location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5, longitude: 77.2 });
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByText("You are offline")).toBeVisible();
  await page.waitForTimeout(1200);
  expect(net.calls.riderWrites.filter((w) => w.body.lat !== undefined)).toHaveLength(0);
});
