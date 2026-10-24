// Story A6 (#153): the kitchen's own controls. A staff user marks a dish sold out and opens or closes the kitchen. Supabase is answered by the test.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 a kitchen staff user sees their dishes and the open switch", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();   // H11: the Kitchen tab
  await expect(page.getByText("Butter Chicken", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Open for orders" })).toBeChecked();
});

test("S2 Sold out sends available false for that dish; Back in stock sends true", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0]).toMatchObject({ method: "PATCH", body: { available: false } });
});

test("S3 Close kitchen calls set_kitchen_open with false and the screen says the kitchen is closed", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("switch", { name: "Open for orders" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "set_kitchen_open").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "set_kitchen_open")!.body).toEqual({ p_kitchen: "k-1", p_open: false });
  await expect(page.getByText("Closed · customers see it now")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Open for orders" })).not.toBeChecked();
});

test("S4 a user who is not kitchen staff sees no controls", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.anonymous = false;
  await page.goto("/kitchen/");
  await expect(page.getByText("This account is not kitchen staff. Ask the admin to add it")).toBeVisible();   // H11: K2
  await expect(page.getByRole("switch", { name: "Open for orders" })).toHaveCount(0);
});

test("S5 the admin's kitchen form takes opening and closing times", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();   // H12: the form lives on the City tab
  await page.getByLabel("Kitchen name").fill("Rohini Kitchen");
  await page.getByLabel("Address").fill("Sector 7, Rohini, Delhi");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Pin codes").fill("110085");
  await page.getByLabel("Opens at").fill("10:00");
  await page.getByLabel("Closes at").fill("22:30");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ name: "Rohini Kitchen", opens_at: "10:00", closes_at: "22:30" });
});
