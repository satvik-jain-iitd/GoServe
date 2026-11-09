// Story #922: when the rider taps Arriving, the customer's Placed screen says "Rider at your door" and the rider card names who is there.
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const arriving = { id: "e1", order_id: ID, event: "order.arriving" };

test("S1 the rider taps Arriving: the step and the rider card change within 3 seconds, with no reload", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi Kumar", phone: "9876500000" };
  await page.goto("/customer/");
  await expect(page.getByTestId("rider-card")).toContainText("is bringing your order");
  await expect(page.getByText("Rider at your door")).toHaveCount(0);
  net.state.events = [arriving];   // the row exists when the event arrives, as in the database
  net.push("INSERT", arriving, "order_events");
  await expect(page.getByText("Rider at your door")).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId("rider-card")).toContainText("Ravi is at your door");
  await expect(page.getByRole("link", { name: "Call Ravi Kumar" })).toBeVisible();   // the call link stays
});

test("S2 a customer who opens the app after the tap (reload, second device) sees it at once", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi Kumar", phone: "9876500000" };
  net.state.events = [arriving];
  await page.goto("/customer/");
  await expect(page.getByText("Rider at your door")).toBeVisible();
});

test("S3 an arriving event of a delivered order says nothing new (the order is over)", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("delivered", "2020-01-01T10:05:00Z"), paid_by: "cash" }]);
  net.state.events = [arriving];
  await page.goto("/customer/");
  await expect(page.getByText("Rider at your door")).toHaveCount(0);
});
