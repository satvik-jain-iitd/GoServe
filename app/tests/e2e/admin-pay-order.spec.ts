// Story 1833 (epic 1831): inside Payment methods the QR sits under UPI at the door, the two not-set-up ways have no switch, and "Last changed" shows once at the bottom.
import { test, expect } from "@playwright/test";
import { setup, openSetting } from "./helpers";

test("Q1 row order, no dead switches, one last-changed line at the bottom", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await openSetting(page, "Payment methods");
  await expect(page.getByRole("switch", { name: /^Cash at the door/ })).toBeEnabled();
  const y = async (loc: import("@playwright/test").Locator) => (await loc.first().boundingBox())!.y;
  const ys = [await y(page.getByText("Cash at the door", { exact: true })), await y(page.getByText("UPI at the door", { exact: true })), await y(page.getByText("UPI QR", { exact: true })),
    await y(page.getByText("Not set up yet", { exact: true })), await y(page.getByText("UPI online", { exact: true })), await y(page.getByText("Card online", { exact: true })), await y(page.getByText(/^Last changed by/))];
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  await expect(page.getByRole("switch", { name: /UPI online|Card online/ })).toHaveCount(0);
  await expect(page.getByText("Not set up yet", { exact: true })).toHaveCount(1);
  await expect(page.getByText(/^Last changed by/)).toHaveCount(1);
});
