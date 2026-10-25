// Story H7 (#190): the admin Simulator tab. Seed, reset, the tick switch and a tick now, all through n8n (https://sim.test, answered by the test). Never the database.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const open = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "Simulator", exact: true }).click(); };

test("S1 the tab asks the webhook for the status and shows the counts, the switch and the synthetic-only line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await expect(page.getByRole("heading", { name: "Simulator", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic only. Real kitchens, riders and orders never change.")).toBeVisible();
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 20 riders (14 online) · 60 dishes");
  await expect(page.getByRole("switch", { name: "City moves every minute" })).not.toBeChecked();
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);
  expect(net.calls.sim[0].headers["x-gs-sim-token"]).toBe("sim-token");
  expect(await axeScan(page)).toEqual([]);
});

test("S2 Seed posts the parameters and shows the new counts; nothing goes to the database", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await page.getByLabel("Kitchens", { exact: true }).fill("12");
  await page.getByLabel("Seed number").fill("7");
  await page.getByRole("button", { name: "Seed the city" }).click();
  await expect(page.getByTestId("sim-counts")).toHaveText("12 kitchens · 20 riders (14 online) · 72 dishes");
  await expect(page.getByRole("status")).toContainText("Seeded: 12 kitchens, 20 riders, 72 dishes.");
  const seed = net.calls.sim.find((c) => c.body.action === "seed")!;
  expect(seed.body).toEqual({ action: "seed", kitchens: 12, riders: 20, dishes_per_kitchen: 6, seed: 7, open_pct: 80, online_pct: 70 });
  expect(net.calls.kitchenWrites).toEqual([]);   // the admin's own reads (is_admin, numbers) may run; no sim_* function is ever called from the app
  expect(net.calls.rpc.filter((r) => r.name.startsWith("sim_"))).toEqual([]);
  expect(net.calls.menuWrites).toEqual([]);
});

test("S3 Reset asks first, then posts reset and the counts drop to zero", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  page.once("dialog", (d) => { expect(d.message()).toContain("Remove every synthetic kitchen, rider and dish?"); void d.accept(); });
  await page.getByRole("button", { name: "Reset the city" }).click();
  await expect(page.getByTestId("sim-counts")).toHaveText("0 kitchens · 0 riders (0 online) · 0 dishes");
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status", "reset"]);
});

test("S4 the switch sends enable then disable; Tick now sends tick and reports what moved", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const sw = page.getByRole("switch", { name: "City moves every minute" });
  await sw.click();
  await expect(sw).toBeChecked();
  await page.getByRole("button", { name: "Tick now" }).click();
  await expect(page.getByRole("status")).toContainText("Tick: 14 riders moved, 1 kitchen flipped, 2 dishes flipped, 1 rider flipped.");
  await sw.click();
  await expect(sw).not.toBeChecked();
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status", "enable", "tick", "disable"]);
});

test("S5 a refused call shows the server's line and leaves the counts as they were", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  net.state.reply = { status: 503, body: { ok: false, error: "kill_switch", message: "The simulator is paused." } };
  await page.getByRole("button", { name: "Seed the city" }).click();
  await expect(page.getByRole("alert")).toContainText("The simulator is paused.");
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 20 riders (14 online) · 60 dishes");
});
