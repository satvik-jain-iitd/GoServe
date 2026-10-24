// Story #52: split view, a second device that joins a session, and reset. The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const OTHER = "7e57ab1e-0000-4000-8000-0000000000b2";

async function placeOne(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Delivery address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: "Review bill" }).click();
  await page.getByRole("button", { name: "Place order (cash on delivery)" }).click();
}

test("S1 split view shows the customer and the kitchen side by side", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/");
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByRole("heading", { name: "Kitchen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await placeOne(page);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("INSERT", order("placed"));   // what the database sends after the call
  await expect(page.getByText("Order 0f0f0f0f", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  const kitchen = await page.getByRole("heading", { name: "Kitchen" }).boundingBox();
  const customer = await page.getByRole("heading", { name: "Order placed" }).boundingBox();
  expect(Math.abs(kitchen!.y - customer!.y)).toBeLessThan(80);   // same row: side by side, not stacked
  expect(kitchen!.x).toBeGreaterThan(customer!.x);
});

test("S2 a second device opens the link, joins the session and sees its orders", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto(`/?join=${OTHER}`);
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  expect(net.calls.rpc).toContainEqual({ name: "join_session", body: { p_session: OTHER } });
  expect(net.calls.orderReads.some((u) => u.includes(`session_id=eq.${OTHER}`))).toBe(true);   // reads the joined session, not its own
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  expect(net.calls.status[0].body.session_id).toBe(SESSION);   // the tap names the order's own session
});

test("S2 the share link carries this device's session", async ({ page, context }) => {
  await setup(context, page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Copy link for a second device" }).click();
  await expect(page.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`\\?join=${SESSION}$`));
});

test("S3 reset asks first, then clears this session and returns to the menu", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("Clear all orders of this demo?")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "reset_session")).toHaveLength(0);   // nothing yet
  await page.getByRole("button", { name: "Yes, clear" }).click();
  await expect(page.getByText("No orders yet.")).toBeVisible();
  expect(net.calls.rpc).toContainEqual({ name: "reset_session", body: { p_session: SESSION } });
  await page.getByRole("button", { name: "Customer" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S3 saying no keeps everything", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen" }).click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "No, keep" }).click();
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "reset_session")).toHaveLength(0);
});

test("S3 when the other device resets, this one clears too", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  net.push("DELETE", { id: "0f0f0f0f-1111-4222-8333-444444444444" });
  await expect(page.getByText("No orders yet.")).toBeVisible({ timeout: 5000 });
});

test("S3 when the other device resets, the customer tracker goes back to the menu", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/");
  await placeOne(page);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("accepted", "2020-01-01T10:01:00Z"));   // proves the tracker reads the list
  await expect(page.locator("[aria-current=step]")).toHaveText("Accepted", { timeout: 5000 });
  net.push("DELETE", { id: "0f0f0f0f-1111-4222-8333-444444444444" });
  await expect(page.getByRole("heading", { name: "Order placed" })).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});
