// Story 1714: Reset the city asks in our own danger sheet, never a browser box.
import { test, expect, type Page } from "@playwright/test";
import { setup, openSetting } from "./helpers";

const open = async (page: Page) => { await page.goto("/admin/"); await openSetting(page, "Simulator"); };
const ask = async (page: Page) => { await page.getByRole("button", { name: "Reset the city" }).click(); return page.getByRole("dialog", { name: "Reset the city?" }); };

test("R1 the sheet appears, no browser dialog; the red button sleeps until the word matches; Keep the city sends nothing", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  let native = 0;
  page.on("dialog", (d) => { native++; void d.dismiss(); });
  await open(page);
  const sheet = await ask(page);
  await expect(sheet).toContainText("Remove every synthetic kitchen, rider and dish? Real ones stay.");
  const go = sheet.getByRole("button", { name: "Reset", exact: true });
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type RESET to go on").fill("RES");
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type RESET to go on").fill("RESET");
  await expect(go).toBeEnabled();
  await sheet.getByRole("button", { name: "Keep the city" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(native).toBe(0);
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);
});

test("R2 phone Back closes the sheet and sends nothing", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  await ask(page);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status"]);
});

test("R3 the red button runs the reset once", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const sheet = await ask(page);
  await sheet.getByLabel("Type RESET to go on").fill("RESET");
  await sheet.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("sim-counts")).toHaveText("0 kitchens · 0 riders (0 online) · 0 dishes");
  expect(net.calls.sim.map((c) => c.body.action)).toEqual(["status", "reset"]);
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`R4 the pair is two equal halves on one line (${w}x${h})`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.admin = true;
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    const sheet = await ask(page);
    await page.waitForTimeout(500);   // the sheet slides in; measure it at rest
    const a = (await sheet.getByRole("button", { name: "Reset", exact: true }).boundingBox())!;
    const b = (await sheet.getByRole("button", { name: "Keep the city" }).boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(a.x).toBeLessThan(b.x);   // red left, safe right
    if (w === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1714-sim-reset-sheet-390x844.png" });
  });
}
