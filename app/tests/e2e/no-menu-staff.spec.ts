// Story H2 (#185): the kitchen, rider, ops and admin apps have nothing to sell, so they never read the menu.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const app of ["kitchen", "rider", "ops", "admin"]) {
  test(`S2 /${app}/ reads no menu_items`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.admin = true;
    await page.goto(`/${app}/`);
    await page.waitForLoadState("networkidle");
    expect(net.calls.menuReads).toHaveLength(0);
  });
}

test("S2 the customer app still reads the menu", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(net.calls.menuReads.length).toBeGreaterThan(0);
});
