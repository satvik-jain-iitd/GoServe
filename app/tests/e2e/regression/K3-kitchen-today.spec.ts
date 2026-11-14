// Regression: the kitchen Today tab (board KD1, story 1456). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });

test("TC K3.1 on a small phone the Today header says Today and the first dish shows with no scroll, above Sign out", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  const dish = (await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).boundingBox())!;
  expect(dish.y + dish.height).toBeLessThanOrEqual(640 - 64);   // above the tab bar, no scroll needed
  expect((await page.getByRole("button", { name: "Sign out" }).boundingBox())!.y).toBeGreaterThan(dish.y);
});
