// Story 1396: the phone's Back button closes what is on top (a sheet, You, Deliver to) and shows the screen under it. On the menu it leaves the app.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

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

// Story 1415: the bill, the tracker, orders and the pin map get a Back step too, and every customer sheet closes on Back.
test("S6 Back on the bill shows the menu, with the cart as it was", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeVisible();
  await page.goBack();
  await onMenu(page);
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("1 item");
});

test("S7 Back on the tracker shows the screen under it (the menu)", async ({ page, context }) => {
  await setup(context, page, [order("placed", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();   // an open order opens on the tracker
  await page.goBack();
  await onMenu(page);
});

test("S8 Back on orders shows the menu; Back on a slip opened from orders shows orders", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", "2020-01-01T11:00:00Z"), paid_by: "cash" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await page.goBack();
  await onMenu(page);
});

test("S9 Back on the pin map closes the map and shows the screen it was opened from", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Pin map" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
});

test("S10 Back closes the cancel sheet and keeps the order", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByRole("dialog", { name: "Cancel this order?" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "cancel_order")).toHaveLength(0);
});

test("S11 after Place order, Back on the tracker shows the menu, never the bill again", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);
  await onMenu(page);
});
