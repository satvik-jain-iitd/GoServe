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
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 40 riders (29 online) · 137 dishes");
  await expect(page.getByRole("switch", { name: "City moves every minute" })).not.toBeChecked();
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);
  expect(net.calls.sim[0].headers["x-gs-sim-token"]).toBe("sim-token");
  expect(await axeScan(page)).toEqual([]);
});

test("S2 Seed posts the parameters and shows the new counts; nothing goes to the database", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await page.getByLabel("Riders per kitchen").fill("6");   // #284: the seed loads the fixed Delhi list; only the riders are a choice
  await page.getByRole("button", { name: "Seed the city" }).click();
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 60 riders (42 online) · 137 dishes");
  await expect(page.getByRole("status")).toContainText("Seeded: 10 kitchens, 60 riders, 137 dishes.");
  const seed = net.calls.sim.find((c) => c.body.action === "seed")!;
  expect(seed.body).toEqual({ action: "seed", riders_per_kitchen: 6, online_pct: 70 });
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
  await page.getByRole("button", { name: "Seed the city" }).click();
  await expect(page.getByRole("alert")).toContainText("The simulator is paused.");
  await expect(page.getByTestId("sim-counts")).toHaveText("10 kitchens · 40 riders (29 online) · 137 dishes");
});

test("S6 (#284) the four scenario knobs show their values and Save posts them", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await expect(page.getByLabel("Kitchen turns the order away %")).toHaveValue("5");
  await expect(page.getByLabel("Item sold out %")).toHaveValue("3");
  await expect(page.getByLabel("Kitchen is slow %")).toHaveValue("10");
  await expect(page.getByLabel("Rider drops out %")).toHaveValue("2");
  await page.getByLabel("Kitchen turns the order away %").fill("12");
  await page.getByLabel("Rider drops out %").fill("30");
  await page.getByRole("button", { name: "Save the scenario" }).click();
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
        seedH: box(btn("Seed the city")).height, saveH: box(btn("Save the scenario")).height, tickH: box(btn("Tick now")).height, resetH: box(btn("Reset the city")).height,
        fieldToField: gap(input("sim-riders_per_kitchen"), document.getElementById("sim-online_pct")!.previousElementSibling!),
        lastFieldToSeed: gap(input("sim-online_pct"), btn("Seed the city")),
        lastFieldToSave: gap(input("sim-rider_drop_pct"), btn("Save the scenario")),
        tickToSeed: gap(btn("Tick now"), document.querySelector('[aria-label="Seed parameters"]')!),
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
