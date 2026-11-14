// Regression: the rider's past days (boards PD1 to PD3, story 1442). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });

test("TC R5.1 on a small phone, older cash due is on top of Today, Pichhle din opens a day, and the day shows no name and no address", async ({ page, context }) => {
  const now = new Date(2026, 10, 14, 15, 0, 0);
  await page.clock.install({ time: now });
  const y = new Date(2026, 10, 13, 13, 0, 0).toISOString();
  await setup(context, page, [{ ...order("delivered", y, y), delivered_at: y, rider_id: SESSION, paid_by: "cash", total_paise: 42000, customer_name: "Rahul Verma", address: "Flat 4, Green Park" }]);
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("older-cash")).toContainText("₹420");
  await page.getByRole("button", { name: /^Pichhle din/ }).click();
  await page.getByTestId("past-day").first().click();
  await expect(page.getByTestId("past-cash")).toContainText("Baaki ₹420");
  for (const t of ["Rahul", "Green Park"]) await expect(page.getByText(t)).toHaveCount(0);
  const b = (await page.getByTestId("past-order").first().boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(640);
});
