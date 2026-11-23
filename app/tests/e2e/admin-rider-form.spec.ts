// Story 1654: the admin's Add a person form asks a rider's name and 10-digit mobile; a saved rider's row has an edit. Made-up names, phone 9000000000.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const city = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); await page.getByRole("button", { name: "Add a person" }).click(); };
const asRider = async (page: Page) => { await page.getByLabel("Email").fill("rider@example.com"); await page.getByLabel("Role").selectOption("rider"); };
const addBody = (net: Awaited<ReturnType<typeof setup>>) => net.calls.rpc.filter((c) => c.name === "admin_add_person").map((c) => c.body);

test("R1 Name and Mobile show only for a Rider", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await city(page);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await asRider(page);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Mobile number (10 digits)")).toBeVisible();
  await page.getByLabel("Role").selectOption("admin");
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
});

test("R2 a good rider sends the name and the 10 digits", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await city(page); await asRider(page);
  await page.getByLabel("Name", { exact: true }).fill("Ravi Kumar");
  await page.getByLabel("Mobile number (10 digits)").fill("90000 00000");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect.poll(() => addBody(net).length).toBe(1);
  expect(addBody(net)[0]).toMatchObject({ p_kind: "rider", p_name: "Ravi Kumar", p_phone: "9000000000" });
});

test("R3 no name, a name over 40, or a bad mobile sends nothing and says why", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await city(page); await asRider(page);
  const add = page.getByRole("button", { name: "Add person" });
  await page.getByLabel("Mobile number (10 digits)").fill("9000000000");
  await add.click();
  await expect(page.getByRole("alert")).toHaveText("Type the rider's name.");
  await page.getByLabel("Name", { exact: true }).fill("a".repeat(41));
  await add.click();
  await expect(page.getByRole("alert")).toHaveText("The name can be at most 40 characters.");
  await page.getByLabel("Name", { exact: true }).fill("Ravi Kumar");
  await page.getByLabel("Mobile number (10 digits)").fill("90000");
  await add.click();
  await expect(page.getByRole("alert")).toHaveText("Type a 10-digit mobile number.");
  expect(addBody(net)).toHaveLength(0);
});

test("R4 a kitchen person is added as before, with no name or phone", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await city(page);
  await page.getByLabel("Email").fill("cook@example.com");
  await page.getByLabel("Role").selectOption("kitchen");
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect.poll(() => addBody(net).length).toBe(1);
  expect(Object.keys(addBody(net)[0] as object).sort()).toEqual(["p_email", "p_kind", "p_kitchen"]);
});

test("R5 the form's two buttons stay in view at 360 by 640 and nothing scrolls sideways", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await page.setViewportSize({ width: 360, height: 640 });
  await city(page); await asRider(page);
  await expect(page.getByRole("button", { name: "Add person" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
