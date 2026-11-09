// Story #967: the tracker catches up when the live channel misses a change. The kitchen declines while the phone's live channel is down (the mock sends no push at all);
// within 30 seconds the read-again brings "Declined" with the reason. Rule 20: one read per 30 s per open tracker.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

test("S1 a decline the channel never delivered shows within 30 seconds", async ({ page, context }) => {
  await page.clock.install({ time: new Date("2026-10-24T06:30:00Z") });
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByText("Order placed")).toBeVisible();
  net.state.orders = [{ ...order("cancelled", "2026-10-24T06:31:00Z"), cancel_reason: "We are out of butter chicken tonight, so this order cannot be made." }];   // no push: only a read can see it
  await page.clock.fastForward(31_000);
  await expect(page.getByText("We are out of butter chicken tonight, so this order cannot be made.")).toBeVisible();
});
