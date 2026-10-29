// Story #619 layer d (board A9): the admin sets the sold-out swap discount (a percent of the new item's price, paid by us) on the Numbers tab.
import { test, expect } from "@playwright/test";
import { scan, setup } from "./helpers";

async function toSettings(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  return net;
}

test("S1 the Settings row shows the percent now and who set it", async ({ page, context }) => {
  await toSettings(page, context);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Sold-out swap discount", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sold-out swap discount, percent")).toHaveValue("10");
  await expect(page.getByText(/^Now 10% · set by owner@goserve.test, /)).toBeVisible();
});

test("S2 Save sends the new percent and the line says it is now that", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await page.getByLabel("Sold-out swap discount, percent").fill("15");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Now 15% · /)).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "swap_discount_set_v2").map((c) => c.body)).toEqual([{ p_pct: 15 }]);
});

test("S3 a percent over 50 is refused before sending, with a plain line", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await page.getByLabel("Sold-out swap discount, percent").fill("60");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Pick a whole number from 0 to 50.")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "swap_discount_set_v2")).toEqual([]);
});

test("S4 the Settings row has no serious contrast or role violation", async ({ page, context }) => {
  await toSettings(page, context);
  await expect(page.getByLabel("Sold-out swap discount, percent")).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
