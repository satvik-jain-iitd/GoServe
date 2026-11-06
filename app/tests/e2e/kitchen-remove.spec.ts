// Story #892, board K-Remove-Confirm (K7): Remove this kitchen asks twice. Ask 1 is this sheet (type REMOVE); ask 2 is the database, which refuses while orders are open.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan } from "./helpers";

const open = async (page: Page) => {
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
  return page.getByRole("dialog", { name: "Remove this kitchen?" });
};
const removes = (net: Awaited<ReturnType<typeof setup>>) => net.calls.rpc.filter((r) => r.name === "kitchen_remove_v2");

test("S1 the row opens the sheet; the red button stays asleep until REMOVE is typed exactly", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  const sheet = await open(page);
  await expect(sheet).toContainText("Ask 1 of 2");
  await expect(sheet).toContainText("Stops");
  await expect(sheet).toContainText("new orders, the menu, every staff sign-in to this kitchen");
  await expect(sheet).toContainText("Finishes");
  await expect(sheet).toContainText("orders already placed, today's slips and cash");
  await expect(sheet).toContainText("Stays");
  await expect(sheet).toContainText("past orders and numbers, the Google account");
  const go = sheet.getByRole("button", { name: "Remove kitchen" });
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type REMOVE to go on").fill("remove");
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await expect(go).toBeEnabled();
  expect(removes(net)).toEqual([]);
  expect(await scan(page)).toEqual([]);   // no contrast or role violation, the red button included
});

test("S2 Keep cooking closes the sheet and nothing changes", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Keep cooking" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(removes(net)).toEqual([]);
  await expect(page.getByRole("region", { name: "Leaving GoServe" })).toBeVisible();
});

test("S3 with open orders the database refuses and the line shows in the sheet; the kitchen stays", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  net.state.removeReply = { ok: false, error: "orders_open", message: "Finish the orders on your tickets first, then remove the kitchen." };
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Remove kitchen" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Finish the orders on your tickets first, then remove the kitchen.");
  expect(removes(net)).toHaveLength(1);
  await expect(sheet).toBeVisible();
});

test("S4 with no open orders the kitchen is removed and the gate shows not staff", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Remove kitchen" }).click();
  await expect(page.getByText("Not kitchen staff yet")).toBeVisible();
  expect(removes(net)).toEqual([{ name: "kitchen_remove_v2", body: { p_kitchen: "k-1" } }]);
});
