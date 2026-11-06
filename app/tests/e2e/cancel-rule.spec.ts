// Story #904: a customer cancels until cooking starts. The button shows at placed and accepted, not from preparing; the line matches the error.
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const COOKING = "The kitchen has started cooking, so this order cannot be cancelled now. Call the kitchen if you need to.";
const CONNECTION = "Could not reach GoServe. Check your connection and try again.";

test("S1 at accepted the Cancel button shows, and tapping it asks the database", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "cancel_order").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "cancel_order")!.body).toEqual({ p_order: ID, p_reason: null });
});

test("S2 from preparing the Cancel button is gone", async ({ page, context }) => {
  await setup(context, page, [order("preparing", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});

test("S3 a forced cancel at cannot_cancel shows the cooking line", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.rpcError = { name: "cancel_order", message: "cannot_cancel: preparing" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText(COOKING)).toBeVisible();
});

test("S4 a dead network shows the connection line, never the cooking line", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await page.route("**/rest/v1/rpc/cancel_order", (r) => r.abort());
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText(CONNECTION)).toBeVisible();
  await expect(page.getByText(COOKING)).toHaveCount(0);
});

test("S5 reason_required (any other error) shows the connection line, not the cooking line", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.rpcError = { name: "cancel_order", message: "reason_required" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText(CONNECTION)).toBeVisible();
  await expect(page.getByText(COOKING)).toHaveCount(0);
});
