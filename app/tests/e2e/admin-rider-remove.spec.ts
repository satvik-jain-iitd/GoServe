// Story 880 (epic E32), board A-City: Remove on a rider who has old orders. The database keeps the orders (scripts/test_rider_remove.py); here the screen is checked.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const city = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); };
const RIDER = { kind: "rider", user_id: "r-9", email: "rider@example.com", kitchen_id: null, kitchen_name: null };

test("S1 Remove asks first, then the rider leaves the list", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [RIDER];
  net.state.riders = [{ user_id: "r-9", name: "Amit Kumar", phone: null, online: false }];
  await city(page);
  await expect(page.getByText("Amit Kumar")).toBeVisible();
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await expect.poll(() => net.calls.rpc.find((c) => c.name === "admin_remove_person")?.body).toEqual({ p_kind: "rider", p_user: "r-9", p_kitchen: null });
  await expect(page.getByText("Amit Kumar")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("S2 with no network the line says so and the rider stays listed", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [RIDER];
  net.state.riders = [{ user_id: "r-9", name: "Amit Kumar", phone: null, online: false }];
  net.state.rpcError = { name: "admin_remove_person", message: "TypeError: Failed to fetch" };
  await city(page);
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await expect(page.getByRole("alert")).toHaveText("No connection. Check the network and try again.");
  await expect(page.getByText("Amit Kumar")).toBeVisible();
});
