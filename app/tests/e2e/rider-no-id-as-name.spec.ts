// Story 1655: a rider with no name never shows any part of an id as a name (kitchen hand-over row, admin city list).
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const NOW = new Date();
const DELIVERED = { ...order("delivered", NOW.toISOString(), new Date(NOW.getTime() - 30 * 60_000).toISOString()), rider_id: SESSION, kitchen_id: "k-1", delivered_at: NOW.toISOString() };

test("R1 kitchen: a rider with no name is called Rider, never an id", async ({ page, context }) => {
  const net = await setup(context, page, [DELIVERED]);
  net.state.kitchen = "k-1";
  net.state.riders = [{ user_id: SESSION, name: "", phone: null, online: true, lat: null, lng: null, updated_at: NOW.toISOString() }];
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm hand-over Rider", exact: true })).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text).not.toContain(SESSION.slice(0, 4));
  expect(text).not.toMatch(/Rider [0-9a-f]{4,}/i);
});

test("R2 admin: a rider with no name and no email is called Rider, never the id", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [{ kind: "rider", user_id: "abcd1234-0000", email: null, kitchen_id: null, kitchen_name: null }];
  net.state.riders = [];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await expect(page.getByText("Rider", { exact: true }).first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("abcd1234");
});
