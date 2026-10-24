// Story #49: the kitchen screen. The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const openKitchen = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();   // H11: the New tab of the Ink boards
};

test("S1 a new order appears on the kitchen screen without a refresh", async ({ page, context }) => {
  const net = await setup(context, page);
  await openKitchen(page);
  await expect(page.getByRole("heading", { name: "No new tickets" })).toBeVisible();
  net.push("INSERT", order("placed"));
  // The 2-second bound is measured against the real server in tests/integration/kitchen.test.ts. Here the wait is longer so a busy test machine does not fail it.
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("2 × Butter Chicken")).toBeVisible();
  await expect(page.locator(".ui-tag", { hasText: "New" })).toBeVisible();   // H11: the tag says New
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();   // the address is on the ticket (K4)
  await expect(page.getByText("Flat 4, Green Park")).toBeVisible();
});

test("S1 orders already placed show when the kitchen opens", async ({ page, context }) => {
  await setup(context, page, [order("accepted")]);
  await openKitchen(page);
  await page.getByRole("button", { name: "Cooking", exact: true }).click();   // H11: an accepted ticket is on the Cooking tab
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible();
});

test("S2 Accept, then Start, then Ready: each tap sends the next step as the kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await openKitchen(page);
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await page.getByRole("button", { name: "Cooking", exact: true }).click();   // H11: Accept from the list stays on New; the ticket is now on Cooking
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start 0f0f0f0f" }).click();
  await expect(page.locator(".ui-tag", { hasText: "Cooking" })).toBeVisible();
  await page.getByRole("button", { name: "Ready 0f0f0f0f" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Accept|Start|Ready) 0f0f0f0f/ })).toHaveCount(0);   // no step button after Ready: the rider takes over
  expect(net.calls.status.map((c) => c.body)).toEqual([
    { action: "status", session_id: SESSION, order_id: ID, to_status: "accepted", actor: "kitchen" },
    { action: "status", session_id: SESSION, order_id: ID, to_status: "preparing", actor: "kitchen" },
    { action: "status", session_id: SESSION, order_id: ID, to_status: "ready", actor: "kitchen" },
  ]);
  expect(net.calls.status[0].headers["x-gs-token"]).toBe("demo-token");
});

test("S2 a live update of the same order moves its card and its button", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await openKitchen(page);
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  net.push("UPDATE", order("accepted", "2020-01-01T10:01:00Z"));
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible({ timeout: 5000 });
});

test("S2 a refused tap shows the reason and keeps the button", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.reply = { status: 409, body: { ok: false, error: "illegal_step", message: "That step is not allowed now." } };
  await openKitchen(page);
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByRole("alert")).toHaveText("That step is not allowed now.");
  await expect(page.getByRole("button", { name: "Accept 0f0f0f0f" })).toBeEnabled();
});

test("an order the rider has taken leaves the kitchen list", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  await openKitchen(page);
  await page.getByRole("button", { name: "Cooking", exact: true }).click();   // H11: a ready ticket waits on the Cooking tab
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  net.push("UPDATE", order("out_for_delivery", "2020-01-01T10:09:00Z"));
  await expect(page.getByText("No. 0f0f0f0f")).toHaveCount(0, { timeout: 5000 });
});

test("the customer menu is one tap away and keeps the cart while you look at the kitchen", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Customer" }).click();
  await expect(page.getByRole("button", { name: "View bill (1)" })).toBeVisible();
});
