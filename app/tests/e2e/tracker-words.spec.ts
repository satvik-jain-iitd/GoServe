// Story #660 (copy audit A.1, A.3, E.3, E.7, E.10, E.13, F.2, F.3): one clock, plain words on the tracker and in Orders.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const TIME = /\b\d{1,2}:\d{2} (am|pm)\b/;

test("S1 the clock line is 12-hour and the address is in normal case", async ({ page, context }) => {
  await setup(context, page, [order("preparing", new Date().toISOString(), new Date().toISOString())]);
  await page.goto("/customer/");
  await expect(page.locator(".ui-clock")).toHaveText(new RegExp(`About \\d+ min · at your door by ${TIME.source}`));
  const addr = page.locator(".ui-addr");
  await expect(addr).toHaveText("Flat 4, Green Park");
  expect(await addr.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
});

test("S2 a cancelled order says there is nothing to pay and offers Order again", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled. Nothing to pay.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "Order again" })).toBeVisible();
});

test("S3 a refused cancel tells the customer the kitchen has started", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.rpcError = { name: "cancel_order", message: "cannot_cancel" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("The kitchen has started, so this order cannot be cancelled now. Call the kitchen if you need to.")).toBeVisible();
});

test("S4 Orders shows the time in 12-hour form", async ({ page, context }) => {
  await setup(context, page, [order("delivered", new Date().toISOString(), new Date().toISOString())]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "My orders", exact: true }).click();
  await expect(page.getByText(new RegExp(`today ${TIME.source}`))).toBeVisible();
});

test("S5 the Orders empty state has the new words", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "My orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await expect(page.getByText("Your orders will show here.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("No sign-in needed");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeVisible();
});

test("S6 a delivered order ends with the thank-you and no Paid tail", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", { ...order("delivered", new Date().toISOString()), paid_by: "cash" });
  await expect(page.getByText("Delivered. Thank you for eating with GoServe.")).toBeVisible({ timeout: 5000 });
  await expect(page.locator("body")).not.toContainText("Paid: cash");
});
