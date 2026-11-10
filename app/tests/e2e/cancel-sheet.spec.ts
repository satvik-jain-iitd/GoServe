// Story #1227 (board CX1-CancelSheet, owner 11 Nov 2026): Cancel order asks first. One tap opens a sheet; only the red button cancels; Keep my order, Close, Escape and the backdrop keep the order.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const open = async (page: Page, context: Parameters<typeof setup>[0], status = "placed") => {
  const net = await setup(context, page, [order(status, "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  return net;
};
const sheet = (page: Page) => page.getByRole("dialog", { name: "Cancel this order?" });
const calls = (net: Awaited<ReturnType<typeof setup>>) => net.calls.rpc.filter((c) => c.name === "cancel_order");

test("C1 one tap on Cancel order opens the sheet and cancels nothing", async ({ page, context }) => {
  const net = await open(page, context);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("heading", { name: "Cancel this order?" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(calls(net)).toHaveLength(0);
});

test("C2 the sheet says what stops, what you pay and what comes after, in the board's words", async ({ page, context }) => {
  await open(page, context, "accepted");
  const s = sheet(page);
  await expect(s.getByText("The kitchen has not started cooking. You can still cancel.")).toBeVisible();
  await expect(s.getByText("Stops", { exact: true })).toBeVisible();
  await expect(s.getByText(/2 × Butter Chicken.*No rider comes\./)).toBeVisible();
  await expect(s.getByText("You pay", { exact: true })).toBeVisible();
  await expect(s.getByText(/^Nothing\./)).toBeVisible();
  await expect(s.getByText("To eat, you place a new order. The time starts again.")).toBeVisible();
});

test("C3 Yes, cancel the order asks the database once and the order shows Cancelled", async ({ page, context }) => {
  const net = await open(page, context);
  await sheet(page).getByRole("button", { name: "Yes, cancel the order" }).click();
  await expect.poll(() => calls(net).length).toBe(1);
  expect(calls(net)[0].body).toEqual({ p_order: ID, p_reason: null });
  await expect(sheet(page)).toHaveCount(0);
});

test("C4 Keep my order, Close, Escape and a tap outside each close the sheet and keep the order", async ({ page, context }) => {
  const net = await open(page, context);
  await sheet(page).getByRole("button", { name: "Keep my order" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await sheet(page).getByRole("button", { name: "Close" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.mouse.click(195, 30);   // the dimmed area above the sheet
  await expect(sheet(page)).toHaveCount(0);
  expect(calls(net)).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();   // the order is still live
});

test("C5 two quick taps on the red button ask the database once", async ({ page, context }) => {
  const net = await open(page, context);
  const yes = sheet(page).getByRole("button", { name: "Yes, cancel the order" });
  await yes.dblclick().catch(() => undefined);   // the second tap lands on a sheet that is already closing
  await page.waitForTimeout(500);
  expect(calls(net)).toHaveLength(1);
});

test("C6 the call cannot reach the server: a true line shows and the order can be cancelled again", async ({ page, context }) => {
  const net = await open(page, context);
  net.state.rpcError = { name: "cancel_order", message: "Failed to fetch" };
  await sheet(page).getByRole("button", { name: "Yes, cancel the order" }).click();
  await expect(page.getByText("Could not reach GoServe. Check your connection and try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toBeEnabled();
});

test("C7 the order was already cancelled on another phone: the line says that, not that cooking started", async ({ page, context }) => {
  const net = await open(page, context);
  net.state.rpcError = { name: "cancel_order", message: "cannot_cancel: cancelled" };
  await sheet(page).getByRole("button", { name: "Yes, cancel the order" }).click();
  await expect(page.getByText("This order is already cancelled.")).toBeVisible();
  await expect(page.getByText(/started cooking/)).toHaveCount(0);
});

test("C8 the kitchen started cooking while the sheet was open: the cooking line shows", async ({ page, context }) => {
  const net = await open(page, context);
  net.state.rpcError = { name: "cancel_order", message: "cannot_cancel: preparing" };
  await sheet(page).getByRole("button", { name: "Yes, cancel the order" }).click();
  await expect(page.getByText("The kitchen has started cooking, so this order cannot be cancelled now. Call the kitchen if you need to.")).toBeVisible();
});
