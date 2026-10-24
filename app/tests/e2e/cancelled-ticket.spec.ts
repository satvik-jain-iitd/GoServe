// Story #230 (F148): a ticket cancelled after Accept or Start shows Cancelled on the Cooking tab for a minute, then leaves. The network is answered by the test.
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "./helpers";

test("S1 a cooking ticket that turns cancelled shows Cancelled for a minute, then leaves the tab", async ({ page, context }) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 20, 0, 0) });
  const net = await setup(context, page, [order("preparing", new Date(2026, 9, 24, 19, 58).toISOString())]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  net.state.orders = [{ ...order("cancelled", new Date(2026, 9, 24, 20, 0, 5).toISOString()), id: ID, cancel_reason: "Customer changed plans" }];   // the customer cancelled
  await page.clock.runFor(5_000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));   // the phone wakes: the list reads again (realtime does the same in prod)
  const ticket = page.locator(".ui-ticket", { hasText: "No. 0f0f0f0f" });
  await expect(ticket).toContainText("Cancelled");
  await expect(ticket).toContainText("Customer changed plans");
  await expect(ticket.getByRole("button", { name: /Ready|Start/ })).toHaveCount(0);   // nothing left to tap
  await page.clock.runFor(130_000);   // the minute tick passes twice
  await expect(page.getByText("No. 0f0f0f0f")).toHaveCount(0);
  await expect(page.getByText("Nothing on the stove")).toBeVisible();
});

test("S1 a ticket cancelled long before the tab opened is not shown", async ({ page, context }) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 20, 0, 0) });
  const net = await setup(context, page, [{ ...order("cancelled", new Date(2026, 9, 24, 19, 50).toISOString()), cancel_reason: "Customer changed plans" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await expect(page.getByText("Nothing on the stove")).toBeVisible();
  await expect(page.getByText("No. 0f0f0f0f")).toHaveCount(0);
});
