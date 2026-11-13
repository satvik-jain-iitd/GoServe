// Regression: the kitchen Cooking tab (board KC1, story 1454). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });

test("TC K1.1 on a small phone Start is outline, Ready is filled, and a Start tap moves the ticket on", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted"), { ...order("preparing"), id: "0b0b0b0b-0000-0000-0000-000000000000" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toHaveClass(/\bghost\b/);
  await expect(page.getByRole("button", { name: "Ready 0b0b0b0b" })).not.toHaveClass(/\bghost\b/);
  await page.getByRole("button", { name: "Start 0f0f0f0f" }).click();
  await expect.poll(() => net.calls.status.map((c) => c.body)).toContainEqual({ order_id: ID, action: "prepare" });
});
