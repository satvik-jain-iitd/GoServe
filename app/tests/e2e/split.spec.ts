// Story #52: split view and a reset by another device. The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const OTHER = "7e57ab1e-0000-4000-8000-0000000000b2";

async function placeOne(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
}

test("S1 split view shows the customer and the kitchen side by side", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/console/");
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();   // H11: the kitchen pane opens on New
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await placeOne(page);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("INSERT", order("placed"));   // what the database sends after the call
  await expect(page.getByText("No. 0f0f0f0f", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  const kitchen = await page.getByRole("heading", { name: "New", exact: true }).boundingBox();
  const customer = await page.getByRole("heading", { name: "Order placed" }).boundingBox();
  expect(Math.abs(kitchen!.y - customer!.y)).toBeLessThan(80);   // same row: side by side, not stacked
  expect(kitchen!.x).toBeGreaterThan(customer!.x);
});

test("S3 when the other device resets, this one clears too", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/console/");
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  net.push("DELETE", { id: "0f0f0f0f-1111-4222-8333-444444444444" });
  await expect(page.getByRole("heading", { name: "No new tickets" })).toBeVisible({ timeout: 5000 });   // H11: K6
});

test("S3 when the other device resets, the customer tracker goes back to the menu", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/console/");
  await placeOne(page);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("accepted", "2020-01-01T10:01:00Z"));   // proves the tracker reads the list
  await expect(page.locator("[aria-current=step]")).toHaveText("AcceptedNow", { timeout: 5000 });
  net.push("DELETE", { id: "0f0f0f0f-1111-4222-8333-444444444444" });
  await expect(page.getByRole("heading", { name: "Order placed" })).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});
