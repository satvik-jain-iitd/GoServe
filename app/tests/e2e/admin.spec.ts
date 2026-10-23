// Story A2 (#149): the admin app at /admin/. Supabase is answered by the test (see helpers.ts).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 an admin sees the Kitchens and Staff tabs and the kitchens", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await expect(page.getByRole("tab", { name: "Kitchens" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Staff" })).toBeVisible();
  await expect(page.getByText("Hauz Khas Kitchen")).toBeVisible();
  await expect(page).toHaveTitle("GoServe Admin");
});

test("S2 someone who is not an admin sees 'Not allowed' and no tabs", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/admin/");
  await expect(page.getByText("Not allowed")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Kitchens" })).toHaveCount(0);
});

test("S3 adding a kitchen sends its name and pin codes; a bad pin code is refused before sending", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByLabel("Kitchen name").fill("Lajpat Nagar Kitchen");
  await page.getByLabel("Pin codes").fill("1100");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect(page.getByRole("alert")).toContainText("1100");
  expect(net.calls.kitchenWrites).toHaveLength(0);
  await page.getByLabel("Pin codes").fill("110024, 110049");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].method).toBe("POST");
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ name: "Lajpat Nagar Kitchen", pin_codes: ["110024", "110049"] });
});

test("S4 adding staff by email with a role, and removing one", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [{ kind: "rider", user_id: "u-9", email: "rider@example.com", kitchen_id: null, kitchen_name: null }];
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Staff" }).click();
  await expect(page.getByText("rider@example.com")).toBeVisible();
  await page.getByLabel("Email").fill("cook@example.com");
  await page.getByLabel("Role").selectOption("kitchen");
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "admin_add_person").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "admin_add_person")!.body).toEqual({ p_email: "cook@example.com", p_kind: "kitchen", p_kitchen: "k-1" });
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "admin_remove_person").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "admin_remove_person")!.body).toEqual({ p_kind: "rider", p_user: "u-9", p_kitchen: null });
});
