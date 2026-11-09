// Story #934: the cook taps a new order, reads all of it on a sheet, then accepts or declines with a reason the customer reads.
// Boards K3-OrderSheet, K3-OrderDecline and T2-Declined (canvas row 2l).
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const REASON = "We are out of butter chicken tonight, so this order cannot be made.";

test("S1 the New row has no Accept; a tap opens the order sheet with Accept and Decline", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.locator(".ui-ticket").getByRole("button", { name: /^Accept/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet.getByText("No. 0f0f0f0f")).toBeVisible();
  await expect(sheet.getByText("Deliver to")).toBeVisible();
  await expect(sheet.getByText("Flat 4, Green Park")).toBeVisible();
  await expect(sheet.getByText("Rider collects")).toBeVisible();
  await expect(sheet.getByText("Swipe down to leave it waiting")).toHaveCount(0);   // story #1044
  await expect(sheet.getByText(/says$/)).toHaveCount(0);   // instructions wait for story 935
  await sheet.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect.poll(() => net.calls.status.length).toBe(1);
  expect(net.calls.status[0].body).toEqual({ order_id: ID, action: "accept" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("S2 Decline needs 20 characters; a chip fills a full sentence the cook can edit; the reason is sent", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await page.getByRole("dialog", { name: "Order 0f0f0f0f" }).getByRole("button", { name: "Decline, with a reason" }).click();
  const sheet = page.getByRole("dialog", { name: "Decline order 0f0f0f0f" });
  const red = sheet.getByRole("button", { name: "Decline this order" });
  await expect(red).toHaveAttribute("aria-disabled", "true");
  await sheet.getByLabel("Reason").fill("too busy now");
  await expect(sheet.getByText("12 characters")).toBeVisible();
  await red.click({ force: true });
  expect(net.calls.status).toHaveLength(0);   // asleep: a touch does nothing
  await sheet.getByRole("button", { name: "Out of an ingredient" }).click();
  await expect(sheet.getByLabel("Reason")).toHaveValue("We are out of an ingredient tonight, so this dish cannot be made.");
  await sheet.getByLabel("Reason").fill(REASON);
  await expect(red).not.toHaveAttribute("aria-disabled", "true");
  await red.click();
  await expect.poll(() => net.calls.status.length).toBe(1);
  expect(net.calls.status[0].body).toEqual({ order_id: ID, action: "cancel", reason: REASON });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No new tickets" })).toBeVisible();
});

test("S3 Back to the order returns to the order sheet and sends nothing", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await page.getByRole("button", { name: "Decline, with a reason" }).click();
  await page.getByRole("button", { name: "Back to the order" }).click();
  await expect(page.getByRole("dialog", { name: "Order 0f0f0f0f" })).toBeVisible();
  expect(net.calls.status).toHaveLength(0);
});

test("S4 the Orders row says Declined with the kitchen's line, and the slip shows the kitchen's words", async ({ page, context }) => {
  await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancel_reason: REASON }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".ui-order-row .ui-tag.error")).toHaveText("Declined");
  await expect(page.locator(".ui-order-row")).toContainText("could not take this order.");
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Declined" })).toBeVisible();
  await expect(page.getByText(`“${REASON}”`)).toBeVisible();
  await expect(page.getByText("Nothing to pay")).toBeVisible();
  await expect(page.getByText("Your money is not taken. If you paid online, it comes back in 5 to 7 days.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Order something else" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try another kitchen" })).toHaveCount(0);
  await page.getByRole("button", { name: "Order something else" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" }).first()).toBeVisible();
});

test("S4b a customer's own cancel, recorded as cancelled_by customer, reads Cancelled with no quoted words", async ({ page, context }) => {
  await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancelled_by: "customer", cancel_reason: null }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".ui-order-row .ui-tag.error")).toHaveText("Cancelled");
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Cancelled" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Declined" })).toHaveCount(0);
});

test("S4c an old row whose reason is the text 'cancelled by customer' reads Cancelled", async ({ page, context }) => {
  await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancel_reason: "cancelled by customer" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Declined" })).toHaveCount(0);
});

test("S5 a customer's own cancel still says Cancelled", async ({ page, context }) => {
  await setup(context, page, [order("cancelled", "2020-01-01T10:02:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator(".ui-order-row .ui-tag.error")).toHaveText("Cancelled");
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Cancelled" })).toBeVisible();
  await expect(page.getByText("Your order was cancelled. Nothing to pay.")).toBeVisible();
});
