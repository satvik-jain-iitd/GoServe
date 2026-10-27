// Story #527: the greeting asks for no name it does not have, and "Continue with Google" lives on You only. Supabase and Google are answered by the test.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const NINE = new Date(2026, 9, 27, 9, 0, 0);

test("S1 a new device with no name saved is greeted Good morning!", async ({ page, context }) => {
  await page.clock.install({ time: NINE });
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Good morning!", exact: true })).toBeVisible();
});

test("S2 a customer who typed a name on You is greeted by the first name", async ({ page, context }) => {
  await page.clock.install({ time: NINE });
  const net = await setup(context, page);
  net.state.customer = { user_id: "u", name: "Priya Sharma", phone: "9876543210", address: "Flat 4", pin_code: "110016" };
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Good morning, Priya.", exact: true })).toBeVisible();
});

test("S3 with an empty name, a linked Google profile fills You and the greeting", async ({ page, context }) => {
  await page.clock.install({ time: NINE });
  const net = await setup(context, page);
  net.state.anonymous = false;   // the test's Google profile is "Amit Kumar"
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByTestId("account")).toContainText("Amit");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Good morning, Amit.", exact: true })).toBeVisible();
});

test("S3 a name the customer already typed is never overwritten by Google", async ({ page, context }) => {
  await page.clock.install({ time: NINE });
  const net = await setup(context, page);
  net.state.anonymous = false;
  net.state.customer = { user_id: "u", name: "Priya Sharma", phone: "9876543210", address: "Flat 4", pin_code: "110016" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByTestId("account")).toContainText("Priya Sharma");
  await expect(page.getByTestId("account")).not.toContainText("Amit");
});

test("S4 the Continue with Google button is on You, and not on Menu or Orders", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await page.getByRole("button", { name: "My orders" }).click();
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByTestId("google-signin")).toBeVisible();
});
