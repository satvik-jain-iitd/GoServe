// Story #900, board A-Kitchen-Remove (A8): the admin removes a kitchen from its own page. Ask 1 is the sheet (type REMOVE); ask 2 is the database, which refuses while orders are open.
// (Story #892 built this on the kitchen app for the wrong actor; #900 moved it.)
import { test, expect, type Page } from "@playwright/test";
import { setup, scan } from "./helpers";

const KITCHEN = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };
const open = async (page: Page) => {
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
  return page.getByRole("dialog", { name: "Remove Tau Ka Dhaba?" });
};
const removes = (net: Awaited<ReturnType<typeof setup>>) => net.calls.rpc.filter((r) => r.name === "kitchen_remove_v2");
const admin = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = [KITCHEN];
  return net;
};

test("S1 the kitchen page has a red Remove row under Leaving GoServe; the sheet's button stays asleep until REMOVE is typed exactly", async ({ page, context }) => {
  const net = await admin(page, context);
  const sheet = await open(page);
  await expect(sheet).toContainText("Ask 1 of 2");
  await expect(sheet).toContainText("Customers stop seeing this kitchen today. New orders stop, the menu goes off, and the staff can no longer sign in to it.");
  await expect(sheet).toContainText("Orders already placed are finished as normal, and today's slips and cash are closed.");
  await expect(sheet).toContainText("Past orders, bills and numbers stay. The kitchen stays in this list, marked Off.");
  const go = sheet.getByRole("button", { name: "Remove kitchen" });
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type REMOVE to go on").fill("remove");
  await expect(go).toBeDisabled();
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await expect(go).toBeEnabled();
  expect(removes(net)).toEqual([]);
  expect(await scan(page)).toEqual([]);
});

test("S2 the section carries its caption; Keep it open closes the sheet and nothing changes", async ({ page, context }) => {
  const net = await admin(page, context);
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Keep it open" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(removes(net)).toEqual([]);
  const section = page.getByRole("region", { name: "Leaving GoServe" });
  await expect(section).toContainText("Customers stop seeing it today. It stays in the city list as Off.");
  const red = await section.locator(".ui-danger-text").evaluate((el) => getComputedStyle(el).color);
  const error = await page.evaluate(() => { const d = document.createElement("div"); d.style.color = "var(--md-error)"; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  expect(red).toBe(error);   // red is the error token, not a new colour
});

test("S3 with open orders the database refuses and the sheet says so in the admin's words; the kitchen stays", async ({ page, context }) => {
  const net = await admin(page, context);
  net.state.removeReply = { ok: false, error: "orders_open", message: "Finish the orders on your tickets first, then remove the kitchen." };
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Remove kitchen" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(/^This kitchen has (\d+ )?open orders?\. Finish or cancel them first\.$/);
  expect(removes(net)).toHaveLength(1);
  await expect(sheet).toBeVisible();
});

test("S4 with no open orders the kitchen is removed: the sheet closes and the city list shows it as Off", async ({ page, context }) => {
  const net = await admin(page, context);
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Remove kitchen" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(removes(net)).toEqual([{ name: "kitchen_remove_v2", body: { p_kitchen: "k-1" } }]);
  await page.getByRole("button", { name: "Back to city" }).click();
  await expect(page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ })).toContainText("Off");
});

test("S5 the kitchen app has no Leaving GoServe section, flag or not", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("button", { name: "Send feedback" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Leaving GoServe" })).toHaveCount(0);
  await expect(page.getByText("Remove this kitchen")).toHaveCount(0);
});

test("S6 at 360, 390 and 412 px the sheet, its input and both buttons stay inside the screen, and nothing scrolls sideways", async ({ page, context }) => {
  const net = await admin(page, context);
  void net;
  for (const width of [360, 390, 412]) {
    await page.setViewportSize({ width, height: 800 });
    const sheet = await open(page);
    const inside = await sheet.evaluate((el, w) => {
      const box = (e: Element) => e.getBoundingClientRect();
      return [el, ...el.querySelectorAll("input, button")].every((e) => box(e).left >= 0 && box(e).right <= w + 0.5);
    }, width);
    expect(inside, `${width}px`).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${width}px sideways`).toBe(true);
  }
});

test("S7 a missing database function shows a true line, not 'try again'", async ({ page, context }) => {
  await admin(page, context);
  await context.route("**/rest/v1/rpc/kitchen_remove_v2", (route) => route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
    body: JSON.stringify({ code: "PGRST202", message: "Could not find the function public.kitchen_remove_v2(p_kitchen) in the schema cache" }) }));
  const sheet = await open(page);
  await sheet.getByLabel("Type REMOVE to go on").fill("REMOVE");
  await sheet.getByRole("button", { name: "Remove kitchen" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Could not reach GoServe. Check your connection and try again.");
});
