// Story H3 (#186): one kitchen per staff account, and a loud message when the account is not kitchen staff.
import { test, expect } from "@playwright/test";
import { order, SESSION, setup } from "./helpers";

test("S1 an account that is not kitchen staff is told so, and sees no orders", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/kitchen/");
  await expect(page.getByText("This account is not kitchen staff. Ask the admin.")).toBeVisible();
  await expect(page.getByText("Order 0f0f0f0f")).toHaveCount(0);
  expect(net.calls.orderReads.some((u) => u.includes("session_id=eq."))).toBe(false);
});

test("S2 an admin who is also staff sees the orders of their own kitchen, not the first staff row of the table", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), kitchen_id: "k-2" }]);
  net.state.kitchen = "k-2";
  net.state.staffOther = "k-1";   // another person's row, which an admin can read
  await page.goto("/kitchen/");
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  expect(net.calls.staffReads.every((u) => u.includes(`user_id=eq.${SESSION}`))).toBe(true);
  expect(net.calls.orderReads.some((u) => u.includes("kitchen_id=eq.k-2"))).toBe(true);
});

test("S3 a rider who can also read other riders' rows (an admin) gets their own row", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.otherRider = true;
  await page.goto("/rider/");
  await expect(page.getByText("You are offline").or(page.getByText("You are online"))).toBeVisible();
  expect(net.calls.riderReads.every((u) => u.includes(`user_id=eq.${SESSION}`))).toBe(true);
});
