// Story #1794 (AC-3, AC-6): an order the admin cancelled shows "Declined · reason" for a minute on the kitchen's screen, whatever status the kitchen had, and is never counted.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const REASON = "Out of stock tonight";
const T0 = new Date(2026, 10, 23, 20, 0, 0);
const cancelled = (by: string, reason: string, at = new Date(2026, 10, 23, 20, 0, 5)) => ({ ...order("cancelled", at.toISOString()), id: ID, cancelled_by: by, cancel_reason: reason });
async function open(page: Page, context: any, status: string, tab: string) {
  await page.clock.install({ time: T0 });
  const net = await setup(context, page, [order(status, new Date(2026, 10, 23, 19, 58).toISOString(), new Date(2026, 10, 23, 19, 58).toISOString())]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  if (tab !== "New") await page.getByRole("button", { name: tab, exact: true }).click();
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  return net;
}
const wake = async (page: Page) => { await page.clock.runFor(5_000); await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); };

for (const [status, tab] of [["placed", "New"], ["preparing", "Cooking"], ["ready", "Cooking"]]) {
  test(`AC-6 admin cancel while ${status}: Declined row, not counted, gone after a minute`, async ({ page, context }) => {
    const net = await open(page, context, status, tab);
    net.state.orders = [cancelled("admin", REASON)];
    await wake(page);
    const row = page.locator(".ui-ticket-cancelled", { hasText: "No. 0f0f0f0f" });
    await expect(row.locator(".ui-tag")).toHaveText("Declined");
    await expect(row.locator(".ui-ticket-why")).toHaveText(REASON);
    await expect(row).not.toContainText("stop cooking");
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^New/ })).not.toContainText(/\d/);   // the New badge does not count it
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText("Today · 0 done")).toBeVisible();
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.clock.runFor(130_000);
    await expect(page.getByText("No. 0f0f0f0f")).toHaveCount(0);
  });
}

test("AC-6 an admin cancel the page never saw (opened after, inside the minute) shows Declined", async ({ page, context }) => {
  await page.clock.install({ time: T0 });
  const net = await setup(context, page, [cancelled("admin", REASON)]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.locator(".ui-ticket-cancelled .ui-tag")).toHaveText("Declined");
  await expect(page.locator(".ui-ticket-why")).toHaveText(REASON);
});

test("AC-6 an admin cancel older than a minute is not shown", async ({ page, context }) => {
  await page.clock.install({ time: T0 });
  const net = await setup(context, page, [cancelled("admin", REASON, new Date(2026, 10, 23, 19, 50))]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByText("No. 0f0f0f0f")).toHaveCount(0);
});

test("AC-6 a customer cancel keeps today's words, and one never seen is not shown", async ({ page, context }) => {
  const net = await open(page, context, "preparing", "Cooking");
  net.state.orders = [cancelled("customer", "cancelled by customer")];
  await wake(page);
  await expect(page.locator(".ui-ticket-cancelled")).toHaveText(/Cancelled by the customer · stop cooking/);
  const kitchenWords = cancelled("kitchen", "No gas");
  net.state.orders = [kitchenWords];
  await wake(page);
  await expect(page.locator(".ui-ticket-cancelled")).toContainText("Cancelled · No gas · stop cooking");
});

test("AC-6 a customer cancel of a New order the page had not seen on Cooking shows nothing", async ({ page, context }) => {
  const net = await open(page, context, "placed", "New");
  net.state.orders = [cancelled("customer", "cancelled by customer")];
  await wake(page);
  await expect(page.getByText("No. 0f0f0f0f")).toHaveCount(0);
});

test("AC-6 an HTML reason shows as text", async ({ page, context }) => {
  const net = await open(page, context, "ready", "Cooking");
  net.state.orders = [cancelled("admin", "<b>x</b>")];
  await wake(page);
  await expect(page.locator(".ui-ticket-why")).toHaveText("<b>x</b>");
  await expect(page.locator(".ui-ticket-cancelled b")).toHaveCount(0);
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`AC-6 Declined row at ${w}x${h}: one-line red tag on the right, reason under the dishes in full ink, no sideways scroll`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    const net = await open(page, context, "preparing", "Cooking");
    net.state.orders = [cancelled("customer", "x")];
    await wake(page);
    const a = await page.locator(".ui-ticket-cancelled").boundingBox();
    net.state.orders = [cancelled("admin", REASON)];
    await wake(page);
    const row = page.locator(".ui-ticket-cancelled");
    const b = await row.boundingBox();
    expect(b!.width).toBe(a!.width);
    expect(b!.height - a!.height).toBeLessThanOrEqual(30);   // one reason line more, no more
    const tag = (await row.locator(".ui-tag").boundingBox())!, dish = (await row.locator(".ui-slip-lines").boundingBox())!, why = (await row.locator(".ui-ticket-why").boundingBox())!;
    expect(tag.height).toBeLessThan(26);                       // one line
    expect(tag.x + tag.width).toBeGreaterThan(b!.x + b!.width - 24);   // on the right
    expect(why.y).toBeGreaterThanOrEqual(dish.y + dish.height - 1);    // under the dishes
    expect(why.x + why.width).toBeLessThanOrEqual(tag.x);
    const ink = await page.evaluate(() => [getComputedStyle(document.querySelector(".ui-ticket-why")!).color, getComputedStyle(document.querySelector(".ui-slip-lines")!).color]);
    expect(ink[0]).toBe(ink[1]);                               // full ink, the dishes' colour
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (w === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1794-kitchen-declined-390x844.png" });
  });
}
