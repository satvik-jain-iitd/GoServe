// Story 1396: the phone's Back button closes what is on top (a sheet, You, Deliver to) and shows the screen under it. On the menu it leaves the app.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const onMenu = (page: Page) => expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
const open = async (page: Page, context: Parameters<typeof setup>[0]) => {
  await setup(context, page);
  await page.goto("/customer/");
  await onMenu(page);
};

test("S1 Back closes the dish sheet and keeps the menu", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Butter Chicken details" }).click();
  await expect(page.getByRole("dialog", { name: "Butter Chicken" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await onMenu(page);
});

test("S2 Back closes the filter sheet and keeps the menu", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByRole("dialog", { name: "Filter" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await onMenu(page);
});

test("S3 Back on You shows the menu", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toHaveCount(0);
  await page.goBack();
  await onMenu(page);
});

test("S4 Back on Deliver to shows the menu", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await page.goBack();
  await onMenu(page);
});

test("S5 a sheet closed by its own button leaves no extra Back step: one Back from the menu leaves the app", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("dialog", { name: "Filter" }).getByRole("button", { name: /^Show / }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/customer\//);
});
