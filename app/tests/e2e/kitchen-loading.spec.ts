// Story 884: while the kitchen app loads, the header says "Your kitchen" and "Loading…", not "New" over grey lines.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the waiting screen of the kitchen app says Your kitchen and Loading", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.kitchen = "k-1";
  await context.route("https://test.supabase.co/rest/v1/kitchen_staff**", () => {});   // never answers: the app stays on its waiting screen
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Your kitchen", exact: true })).toBeVisible();
  await expect(page.getByText("Loading…", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New", exact: true })).toHaveCount(0);
});

test("S2 after the load the New tab is unchanged", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your kitchen", exact: true })).toHaveCount(0);
});
