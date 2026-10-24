// Story #224: a customer never signs in. The customer app shows no Google button and no "Signed in as" line, on any screen. Story #242: nothing under the frame; Privacy and Terms live on the You tab.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the customer app has no Continue with Google button below the boards", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();   // the Ink tabs: the boards are up
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveCount(0);   // #242: nothing under the frame; Privacy and Terms are on the You tab
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("S1 a customer phone that once signed in with Google sees no Signed in line either", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.anonymous = false;
  await page.goto("/customer/");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();   // the Ink tabs: the boards are up
  await expect(page.getByTestId("signed-in")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("S2 the kitchen app and the rider app still offer Google sign-in at their gate", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = null;
  await page.goto("/kitchen/");
  await expect(page.getByTestId("google-signin")).toBeVisible();
  await page.goto("/rider/");
  await expect(page.getByTestId("google-signin")).toBeVisible();
});

test("S3 the bottom tabs keep their names on every app: My orders and You (Account) for the customer, Delivery and New for staff", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/customer/");
  for (const name of ["Menu", "My orders", "You (Account)"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.goto("/rider/");
  for (const name of ["Delivery", "Today", "Me"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  for (const name of ["New", "Cooking", "Today"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
});
