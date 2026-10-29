// Story B1 (#157): a refresh keeps the screen. The network is answered by the test (see helpers.ts).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 a refresh on the cart keeps the dishes and the address", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByLabel("Address")).toHaveValue("Flat 4, Green Park");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("S2 a refresh on the bill stays on the bill with the same total", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await expect(page.getByTestId("bill-total")).toHaveText("₹320");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByTestId("bill-total")).toHaveText("₹320");
});

test("S3 after the order is placed the cart is empty again on the next visit", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  const draft = await page.evaluate(() => window.localStorage.getItem("gs-draft"));
  expect(JSON.parse(draft!)).toMatchObject({ step: "menu", cart: {} });
});

test("S4 the demo console at / does not keep a draft", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/console/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
});
