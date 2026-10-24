// Story #224: a customer never signs in. The customer app shows no Google button and no "Signed in as" line, on any screen; Privacy and Terms stay.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the customer app has no Continue with Google button below the boards", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();   // the Ink tabs: the boards are up
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await page.getByRole("link", { name: "Terms" }).scrollIntoViewIfNeeded();   // below the frame, one scroll down
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();
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

test("S3 the bottom tabs keep their names on every app: My orders and You (Account) for the customer, Job and New for staff", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/customer/");
  for (const name of ["Menu", "My orders", "You (Account)"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.goto("/rider/");
  for (const name of ["Job", "Today", "Me"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  for (const name of ["New", "Cooking", "Kitchen"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
});
