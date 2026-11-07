// Story #527 (greeting words removed by #975): a Google name fills an empty name on You, a typed name is kept, and "Continue with Google" lives on You only. Supabase and Google are answered by the test.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S3 with an empty name, a linked Google profile fills You", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.anonymous = false;   // the test's Google profile is "Amit Kumar"
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByTestId("account")).toContainText("Amit");
});

test("S4 a name the customer already typed is never overwritten by Google", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.anonymous = false;
  net.state.customer = { user_id: "u", name: "Priya Sharma", phone: "9876543210", address: "Flat 4", pin_code: "110016" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByTestId("account")).toContainText("Priya Sharma");
  await expect(page.getByTestId("account")).not.toContainText("Amit");
});

test("S5 the Continue with Google button is on You, and not on Menu or Orders", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.phoneUser = true;   // story 829: behind the wall a customer is signed in; one who came by phone code has no Google name
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByTestId("google-signin")).toBeVisible();
});
