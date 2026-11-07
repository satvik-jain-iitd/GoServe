// Story H7 (#190): the admin Simulator tab. Seed, reset, the tick switch and a tick now, all through n8n (https://sim.test, answered by the test). Never the database.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const open = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "Simulator", exact: true }).click(); };
const openRows = async (page: Page) => { await page.getByText("Kitchen scenario", { exact: true }).click(); await page.getByText("Rider scenario", { exact: true }).click(); };   // #848: the scenario numbers sit in two rows that open

test("S1 the tab asks the webhook for the status and shows the counts, the switch and the synthetic-only line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await expect(page.getByRole("heading", { name: "Simulator", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic only. Real kitchens, riders and orders never change.")).toBeVisible();
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 40 riders (29 online) · 137 dishes");
  await expect(page.getByRole("switch", { name: "City moves every minute" })).not.toBeChecked();
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);
  expect(net.calls.sim[0].headers["x-gs-sim-token"]).toBe("sim-token");
  expect(await axeScan(page)).toEqual([]);
});

test("S2 (#848) Seed the riders posts the rider numbers and shows the new counts; Seed the kitchens posts no numbers; nothing goes to the database", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await page.getByText("Rider scenario", { exact: true }).click();
  await page.getByLabel("Riders per kitchen").fill("6");
  await page.getByRole("button", { name: "Seed the riders" }).click();
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 60 riders (42 online) · 137 dishes");
  await expect(page.getByRole("status")).toContainText("Seeded: 60 riders.");
  expect(net.calls.sim.find((c) => c.body.action === "seed_riders")!.body).toEqual({ action: "seed_riders", riders_per_kitchen: 6, online_pct: 70 });
  await page.getByRole("button", { name: "Seed the kitchens" }).click();
  await expect(page.getByRole("status")).toContainText("Seeded: 10 kitchens, 120 dishes.");
  expect(net.calls.sim.find((c) => c.body.action === "seed_kitchens")!.body).toEqual({ action: "seed_kitchens" });
  expect(net.calls.sim.some((c) => c.body.action === "seed")).toBe(false);   // the old both-at-once button is gone
  expect(net.calls.kitchenWrites).toEqual([]);
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
  await expect(page.getByRole("status")).toContainText("Tick: 14 riders moved, 1 kitchen flipped, 2 dishes flipped, 1 rider flipped. Orders: 2 accepted, 1 turned away, 1 delivered, 0 riders dropped.");
  await sw.click();
  await expect(sw).not.toBeChecked();
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status", "enable", "tick", "disable"]);
});

test("S5 a refused call shows the server's line and leaves the counts as they were", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  net.state.reply = { status: 503, body: { ok: false, error: "kill_switch", message: "The simulator is paused." } };
  await page.getByRole("button", { name: "Seed the kitchens" }).click();
  await expect(page.getByRole("alert")).toContainText("The simulator is paused.");
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 40 riders (29 online) · 137 dishes");
});

test("S6 (#284) the four scenario knobs show their values and Save posts them", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await openRows(page);
  await expect(page.getByLabel("Kitchen turns the order away %")).toHaveValue("5");
  await expect(page.getByLabel("Item sold out %")).toHaveValue("3");
  await expect(page.getByLabel("Kitchen is slow %")).toHaveValue("10");
  await expect(page.getByLabel("Rider drops out %")).toHaveValue("2");
  await page.getByLabel("Kitchen turns the order away %").fill("12");
  await page.getByLabel("Rider drops out %").fill("30");
  await page.getByRole("button", { name: "Save the rider scenario" }).click();
  await expect(page.getByRole("status")).toContainText("Scenario saved.");
  expect(net.calls.sim.find((c) => c.body.action === "knobs")!.body).toEqual({ action: "knobs", reject_pct: 12, sold_out_pct: 3, delay_pct: 10, rider_drop_pct: 30 });
  expect(await axeScan(page)).toEqual([]);
});

test("S7 (#454) the Demo mode switch posts demo true then false, and shows the saved state after a reload", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const sw = page.getByRole("switch", { name: "Demo mode" });
  await expect(sw).not.toBeChecked();
  await sw.click();
  await expect(sw).toBeChecked();
  await expect(page.getByRole("status")).toContainText("Demo mode is on");
  await page.reload();
  await page.getByRole("button", { name: "Simulator", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Demo mode" })).toBeChecked();
  await page.getByRole("switch", { name: "Demo mode" }).click();
  await expect(page.getByRole("switch", { name: "Demo mode" })).not.toBeChecked();
  expect(net.calls.sim.filter((c) => c.body.action === "knobs").map((c) => c.body)).toEqual([{ action: "knobs", demo: true }, { action: "knobs", demo: false }]);
  expect(await axeScan(page)).toEqual([]);
});

// #461: the Simulator tab follows the Ink design like the City forms: styled fields, a token gap between fields and between a field and its button, and the same button sizes.
for (const theme of ["day", "night"]) {
  test(`S8 (#461) fields and buttons keep the token sizes and gaps at 390 px in ${theme}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 1500 });
    await context.addInitScript((t) => localStorage.setItem("gs-theme", t), theme);
    const net = await setup(context, page);
    net.state.admin = true;
    await open(page);
    await openRows(page);
    await expect(page.getByLabel("Riders per kitchen")).toBeVisible();
    const m = await page.evaluate(() => {
      const px = (token: string) => { const d = document.createElement("div"); d.style.cssText = `position:absolute;visibility:hidden;height:var(${token})`; document.body.append(d); const h = d.getBoundingClientRect().height; d.remove(); return h; };
      const box = (el: Element) => el.getBoundingClientRect();
      const input = (id: string) => document.getElementById(id) as HTMLElement;
      const btn = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLElement;
      const gap = (a: Element, b: Element) => box(b).top - box(a).bottom;
      return {
        tap: px("--gs-tap"), big: px("--gs-tap-big"), s2: px("--gs-space-2"), s4: px("--gs-space-4"),
        inputH: box(input("sim-riders_per_kitchen")).height, radius: getComputedStyle(input("sim-riders_per_kitchen")).borderTopLeftRadius,
        seedH: box(btn("Seed the riders")).height, saveH: box(btn("Save the rider scenario")).height, tickH: box(btn("Tick now")).height, resetH: box(btn("Reset the city")).height,
        fieldToField: gap(input("sim-riders_per_kitchen"), document.getElementById("sim-online_pct")!.previousElementSibling!),
        lastFieldToSeed: gap(input("sim-online_pct"), btn("Seed the riders")),
        lastFieldToSave: gap(input("sim-rider_drop_pct"), btn("Save the rider scenario")),
        tickToSeed: gap(btn("Tick now"), document.querySelector('[aria-label="Kitchens"]')!),
      };
    });
    expect(m.inputH).toBeGreaterThanOrEqual(m.tap);                      // the field is a full-size tap target, not the browser's thin box
    expect(m.radius).not.toBe("0px");                                    // and it wears the Ink border
    expect(m.seedH).toBe(m.big); expect(m.saveH).toBe(m.big);            // main buttons are the token big size, like Add person on City
    expect(m.tickH).toBe(m.tap); expect(m.resetH).toBe(m.tap);           // the side buttons are the plain size, like + Add a kitchen on City
    expect(m.fieldToField).toBeGreaterThanOrEqual(m.s4 - 1);             // space between two fields
    expect(m.lastFieldToSeed).toBeGreaterThanOrEqual(m.s2);              // a button never hugs the last field
    expect(m.lastFieldToSave).toBeGreaterThanOrEqual(m.s2);
    expect(await axeScan(page)).toEqual([]);
  });
}

// Story #848 (boards A-Sim-Groups and A-Sim-Clear, approved 2026-11-04).
test("S9 (#848) the tab has a Kitchens group and a Riders group, each with its synthetic and real counts and its own seed button", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const kitchens = page.getByRole("region", { name: "Kitchens" });
  const riders = page.getByRole("region", { name: "Riders" });
  await expect(kitchens).toContainText("10 synthetic · 6 real");
  await expect(riders).toContainText("40 synthetic · 2 real");
  await expect(kitchens.getByRole("button", { name: "Seed the kitchens" })).toBeVisible();
  await expect(riders.getByRole("button", { name: "Seed the riders" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seed the city" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Start over" }).getByRole("button", { name: "Reset the city" })).toBeVisible();
  expect(await axeScan(page)).toEqual([]);
});

test("S10 (#848) Clear everything asks for the word CLEAR, then calls the database function with the admin session and shows what went", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await page.getByRole("button", { name: "Clear everything" }).click();
  const sheet = page.getByRole("dialog", { name: "Clear everything?" });
  await expect(sheet).toContainText("This empties the dev city. Seed the kitchens brings it back.");
  await expect(sheet).toContainText("Dev only · cannot be undone");
  await expect(sheet).toContainText("Run log, decision log, and every account.");
  const go = sheet.getByRole("button", { name: "Clear everything" });
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type CLEAR to go on").fill("CLE");
  await expect(go).toBeDisabled();
  expect(await axeScan(page)).toEqual([]);
  await sheet.getByLabel("Type CLEAR to go on").fill("CLEAR");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.getByRole("status")).toContainText("Cleared: 16 kitchens, 42 riders, 137 dishes, 41 orders.");
  await expect(page.getByTestId("sim-counts")).toHaveText("0 kitchens · 0 riders (0 online) · 0 dishes");
  expect(net.calls.rpc.filter((r) => r.name === "sim_clear_all")).toHaveLength(1);
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);   // never the webhook, never the simulator token
});

test("S11 (#848) Keep the city closes the sheet and calls nothing", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await page.getByRole("button", { name: "Clear everything" }).click();
  await page.getByRole("button", { name: "Keep the city" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(net.calls.rpc.filter((r) => r.name === "sim_clear_all")).toEqual([]);
});

test("S12 (#848) a database that does not allow Clear never draws the button, even in a dev build", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.sim.clear_allowed = false;
  await open(page);
  await expect(page.getByTestId("sim-counts")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear everything" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset the city" })).toBeVisible();
});

test("S13 (#848) a refusal from the database shows its line and the city stays", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.clearReply = { ok: false, error: "clear_not_allowed", message: "Clear everything is switched off on this database." };
  await open(page);
  await page.getByRole("button", { name: "Clear everything" }).click();
  await page.getByLabel("Type CLEAR to go on").fill("CLEAR");
  await page.getByRole("dialog").getByRole("button", { name: "Clear everything" }).click();
  await expect(page.getByRole("alert")).toContainText("Clear everything is switched off on this database.");
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 40 riders (29 online) · 137 dishes");
});

test("S14 (#848) the scenario numbers sit in two rows inside their groups; each row shows its numbers as one line and opens to its fields and one Save", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const kitchens = page.getByRole("region", { name: "Kitchens" });
  const riders = page.getByRole("region", { name: "Riders" });
  await expect(kitchens.getByText("Turns away 5% · sold out 3% · slow 10%")).toBeVisible();
  await expect(riders.getByText("4 per kitchen · 70% online · drops out 2%")).toBeVisible();
  await expect(page.getByLabel("Kitchen is slow %")).toBeHidden();   // closed until the row is opened
  await expect(page.getByLabel("Rider drops out %")).toBeHidden();
  await expect(page.getByRole("region", { name: "Scenario" })).toHaveCount(0);   // the mixed Scenario section is gone
  await kitchens.getByText("Kitchen scenario", { exact: true }).click();
  await expect(kitchens.getByLabel("Kitchen is slow %")).toBeVisible();
  await expect(kitchens.getByLabel("Rider drops out %")).toHaveCount(0);
  await riders.getByText("Rider scenario", { exact: true }).click();
  await expect(riders.getByLabel("Rider drops out %")).toBeVisible();
  await expect(riders.getByLabel("Riders per kitchen")).toBeVisible();
  await kitchens.getByLabel("Kitchen is slow %").fill("20");
  await kitchens.getByRole("button", { name: "Save the kitchen scenario" }).click();
  await expect(page.getByRole("status")).toContainText("Scenario saved.");
  expect(net.calls.sim.find((c) => c.body.action === "knobs")!.body).toEqual({ action: "knobs", reject_pct: 5, sold_out_pct: 3, delay_pct: 20, rider_drop_pct: 2 });
  expect(await axeScan(page)).toEqual([]);
});

test("S15 (#873) Clear everything calls the function again until it says done, with the slice size, and shows the totals of all slices", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.clearSlices = 3;   // two slices that are not done, then the last
  await open(page);
  await page.getByRole("button", { name: "Clear everything" }).click();
  await page.getByLabel("Type CLEAR to go on").fill("CLEAR");
  await page.getByRole("dialog").getByRole("button", { name: "Clear everything" }).click();
  await expect(page.getByRole("status")).toContainText("Cleared: 16 kitchens, 42 riders, 137 dishes, 41 orders.");   // 20 + 20 + 1 orders
  const calls = net.calls.rpc.filter((r) => r.name === "sim_clear_all");
  expect(calls).toHaveLength(3);
  expect(calls.every((c) => c.body.p_limit === 500)).toBe(true);
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);
});
