// Story #263 layer 1: the admin's Decisions block on the Numbers tab. One engine is on, chosen through n8n with the admin's own sign-in. Never the database.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const open = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "Numbers", exact: true }).click(); };

test("S1 the block shows the three engines, Rules on, the version and who changed it; Laya is greyed", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const block = page.getByRole("region", { name: "Decisions" });
  await expect(block.getByRole("radio", { name: /^Rules/ })).toBeChecked();
  await expect(block.getByRole("radio", { name: /^Jev/ })).not.toBeChecked();
  const laya = block.getByRole("radio", { name: /^Laya/ });
  await expect(laya).toBeDisabled();
  await expect(block).toContainText("Not deployed yet");
  await expect(block.getByTestId("engine-meta")).toContainText("Version 1");
  expect(net.calls.engine.map((c) => c.body)).toEqual([{ action: "get" }]);
  expect(net.calls.engine[0].headers.authorization).toMatch(/^Bearer .+\..+\..+$/);
  expect(await axeScan(page)).toEqual([]);
});

test("S2 choosing Jev sends one set call and shows Jev with the new version", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const block = page.getByRole("region", { name: "Decisions" });
  await block.getByRole("radio", { name: /^Jev/ }).click();
  await expect(block.getByRole("radio", { name: /^Jev/ })).toBeChecked();
  await expect(block.getByTestId("engine-meta")).toContainText("Version 2");
  await expect(block.getByTestId("engine-meta")).toContainText("owner@goserve.test");
  expect(net.calls.engine.map((c) => c.body)).toEqual([{ action: "get" }, { action: "set", engine: "jev" }]);
  expect(net.calls.kitchenWrites).toEqual([]);   // never a table write from the app
  expect(net.calls.rpc.filter((r) => /decision_engine/.test(r.name))).toEqual([]);
});

test("S3 Laya cannot be chosen: no call, and the line says it is not deployed", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await page.getByRole("region", { name: "Decisions" }).getByRole("radio", { name: /^Laya/ }).click({ force: true });
  await expect(page.getByRole("region", { name: "Decisions" }).getByRole("radio", { name: /^Rules/ })).toBeChecked();
  expect(net.calls.engine.map((c) => c.body.action)).toEqual(["get"]);
});

test("S4 a refusal keeps the old engine on screen and shows the server's line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  net.state.engineReply = { status: 403, body: { ok: false, error: "not_admin", message: "Only an admin can change this." } };
  await page.getByRole("region", { name: "Decisions" }).getByRole("radio", { name: /^Jev/ }).click();
  await expect(page.getByRole("alert")).toContainText("Only an admin can change this.");
  await expect(page.getByRole("region", { name: "Decisions" }).getByRole("radio", { name: /^Rules/ })).toBeChecked();
});
