// Story #224: a customer never signs in. The customer app shows no Google button and no "Signed in as" line, on any screen; Privacy and Terms stay.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the customer app has no Continue with Google button below the boards", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();   // the Ink tabs: the boards are up
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Privacy" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Terms" })).toBeAttached();
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
