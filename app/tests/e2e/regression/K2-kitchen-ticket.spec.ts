// Regression: the kitchen order sheet and Ticket (boards KO1, KK1, story 1455). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { order, setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });

test("TC K2.1 on a small phone the Ticket shows the dishes and the note, no money, and its one button is last and whole", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("preparing"), instructions: "Less spicy please.", address: "Flat 4, Green Park" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByText("Less spicy please.")).toBeVisible();
  await expect(page.getByText("Flat 4, Green Park")).toHaveCount(0);
  await expect(page.locator(".ui-slip").first().getByText("₹")).toHaveCount(0);
  const btns = page.locator(".ui-bottom button");
  await expect(btns).toHaveCount(1);
  const b = (await btns.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(640);
});
