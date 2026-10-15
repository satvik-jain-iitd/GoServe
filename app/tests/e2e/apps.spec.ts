// Story #83: the customer, kitchen, rider and ops apps are separate installable apps on one origin. The network is answered by the test.
import { test, expect } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

test("S2 the kitchen app shows only the kitchen: no role tabs, no demo tools, its own title", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Kitchen", exact: true })).toBeVisible();
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Screen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset demo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Autopilot" })).toHaveCount(0);
  await expect(page).toHaveTitle("GoServe Kitchen");
});

test("S2 the rider app, the ops app and the customer app each open on their own screen", async ({ page, context }) => {
  await setup(context, page, [order("ready")]);
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Rider", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeVisible();
  await expect(page).toHaveTitle("GoServe Rider");
  await page.goto("/ops/");
  await expect(page.getByRole("heading", { name: "Ops", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("GoServe Ops");
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Screen" })).toHaveCount(0);
  await expect(page).toHaveTitle("GoServe");
});

test("S2 the demo console at / is unchanged: five tabs and the demo tools", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  for (const name of ["Customer", "Kitchen", "Rider", "Split", "Ops"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
});

test("S2 each app points to its own manifest, with its own name, install identity and scope", async ({ page, context }) => {
  await setup(context, page);
  for (const [path, role, name] of [["/kitchen/", "kitchen", "GoServe Kitchen"], ["/rider/", "rider", "GoServe Rider"], ["/ops/", "ops", "GoServe Ops"], ["/customer/", "customer", "GoServe"]]) {
    await page.goto(path);
    const href = await page.locator("link[rel=manifest]").getAttribute("href");
    expect(href).toBe(`/manifests/${role}.webmanifest`);
    const m = await page.evaluate(async (h) => (await fetch(h!)).json(), href);
    expect(m).toMatchObject({ name, id: `/${role}/`, scope: `/${role}/`, start_url: `/${role}/` });
  }
});

test("S1 one device: the customer app and the kitchen app share one session, with no sign-in twice and no link", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View cart/ }).click();
  await page.getByLabel("Delivery address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: "Review bill" }).click();
  await page.getByRole("button", { name: "Place order (pay later)" }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.calls.signups).toBe(1);
  const kitchen = await context.newPage();   // a second app window on the same device (same browser profile)
  await kitchen.goto("/kitchen/");
  await expect(kitchen.getByText("Order 0f0f0f0f")).toBeVisible();
  const rider = await context.newPage();
  await rider.goto("/rider/");
  await expect(rider.getByRole("heading", { name: "Rider", exact: true })).toBeVisible();
  expect(net.calls.signups).toBe(1);   // the kitchen app and the rider app reused the customer app's session
  expect(net.calls.orderReads.filter((u) => u.includes(`session_id=eq.${SESSION}`)).length).toBeGreaterThanOrEqual(2);
});

test("S1 one device: a tap in the kitchen app reaches the order the customer app placed", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  expect(net.calls.status[0].body).toMatchObject({ order_id: ID, session_id: SESSION, to_status: "accepted", actor: "kitchen" });
});

test("S3 another device opens the link on the kitchen address and joins that session", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  const OTHER = "7e57ab1e-0000-4000-8000-0000000000b2";
  await page.goto(`/kitchen/?join=${OTHER}`);
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  expect(net.calls.rpc).toContainEqual({ name: "join_session", body: { p_session: OTHER } });
  expect(net.calls.orderReads.some((u) => u.includes(`session_id=eq.${OTHER}`))).toBe(true);
  expect(page.url()).not.toContain("join=");   // the link is tidied away, and the address stays on the kitchen app
  expect(new URL(page.url()).pathname).toBe("/kitchen/");
});
