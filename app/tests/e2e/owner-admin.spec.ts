// Story #985: the owner account is the one superadmin. Its row in People says Owner and has no Remove button; other admins keep theirs.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";
import { OWNER_EMAIL } from "../../src/lib/admin";

const city = async (page: import("@playwright/test").Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); };
const admin = (id: string, email: string) => ({ kind: "admin", user_id: id, email, kitchen_id: null, kitchen_name: null });

test("S1 the owner row shows Owner and no Remove button; another admin keeps Remove", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [admin("u-owner", OWNER_EMAIL), admin("u-2", "second.admin@example.com")];
  await city(page);
  const owner = page.locator(".ui-row", { hasText: OWNER_EMAIL });
  await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
  await expect(owner.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove second.admin@example.com" })).toBeVisible();
});

test("S2 the owner is the owner whatever the letter case of the address", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [admin("u-owner", OWNER_EMAIL.toUpperCase())];
  await city(page);
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
});

test("S3 the database's owner_admin refusal says it plainly", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [admin("u-2", "second.admin@example.com")];
  net.state.rpcError = { name: "admin_remove_person", message: "owner_admin" };
  await city(page);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Remove second.admin@example.com" }).click();
  await expect(page.getByRole("alert")).toContainText("The owner account cannot be removed.");
});
