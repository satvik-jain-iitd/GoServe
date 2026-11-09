// Story 885, board A-AddPerson-Invite: the error of a failed Add person shows under the form, next to the button; other errors stay at the top.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const city = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); };
const fill = async (page: Page) => {
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Email").fill("cook@example.com");
  await page.getByLabel("Role").selectOption("kitchen");
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByRole("button", { name: "Add person" }).click();
};

test("S1 a failed Add person shows its line inside the form section, once", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.rpcError = { name: "admin_add_person", message: "not_allowed" };
  await city(page);
  await fill(page);
  const section = page.getByRole("region", { name: "Riders" });
  await expect(section.getByRole("alert")).toHaveText("Not allowed.");
  await expect(page.getByRole("alert")).toHaveCount(1);
});

test("S2 a new try clears the line under the form", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.rpcError = { name: "admin_add_person", message: "not_allowed" };
  await city(page);
  await fill(page);
  await expect(page.getByRole("alert")).toHaveCount(1);
  net.state.rpcError = null;
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("S3 a failed remove still shows at the top, not in the form section", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [{ kind: "rider", user_id: "r-9", email: "rider@example.com", kitchen_id: null, kitchen_name: null }];
  net.state.riders = [{ user_id: "r-9", name: "Amit Kumar", phone: null, online: false }];
  net.state.rpcError = { name: "admin_remove_person", message: "last_admin" };
  await city(page);
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await expect(page.getByRole("alert")).toHaveText("This is the last admin. Add another admin first.");
  await expect(page.getByRole("region", { name: "Riders" }).getByRole("alert")).toHaveCount(0);
});
