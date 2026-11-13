// Regression: the rider incentive (boards TI1 and AR1, stories 1443 and 1438). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });

test("TC R4.1 the admin turns the incentive on at ₹10; on a small phone the rider's Today shows it under the cash, and the cash is unchanged", async ({ page, context }) => {
  const at = new Date(Date.now() - 20_000).toISOString();
  const net = await setup(context, page, [{ ...order("delivered", at, at), rider_id: SESSION, paid_by: "cash" }]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await page.getByRole("switch", { name: /^Incentive/ }).click();
  await expect(page.getByTestId("incentive-amount")).toHaveText("₹10");
  net.state.incentive = { ...net.state.incentive, log: [{ at: new Date(Date.now() - 60_000).toISOString(), on: true, amount_paise: 1000 }] };
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("incentive")).toContainText("1 delivery × ₹10 · salary ke saath milega");
  await expect(page.getByTestId("cash")).toContainText("₹640");
  const b = (await page.getByTestId("incentive").boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(640);
});
