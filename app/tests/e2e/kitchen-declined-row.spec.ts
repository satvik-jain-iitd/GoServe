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
    const row = page.locator(".ui-declined", { hasText: "No. 0f0f0f0f" });
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
  await expect(page.locator(".ui-declined .ui-declined-title")).toHaveText("Order declined");
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
  await expect(page.locator("body")).not.toContainText("<b>x</b>");   // no reason text anywhere
  await expect(page.locator(".ui-declined")).toContainText("Order declined");
  await expect(page.locator(".ui-ticket-cancelled b")).toHaveCount(0);
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`AC-6 Declined box at ${w}x${h}: red 4 px left edge, no reason, in the gutter, one short line, readable red, no sideways scroll`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    const net = await open(page, context, "preparing", "Cooking");
    net.state.orders = [cancelled("admin", REASON)];
    await wake(page);
    const box = page.locator(".ui-declined");
    await expect(box.locator(".ui-declined-title")).toHaveText("Order declined");
    await expect(page.locator("body")).not.toContainText(REASON);
    const b = (await box.boundingBox())!, t = (await box.locator(".ui-declined-title").boundingBox())!;
    expect(b.x).toBe(20);
    expect(b.width).toBe(w - 40);
    expect(t.height).toBeLessThan(26);   // one short line
    const css = await page.evaluate(() => {
      const bx = document.querySelector(".ui-declined")!, ti = bx.querySelector(".ui-declined-title")!;
      const lum = (c: string) => { const m = c.match(/[\d.]+/g)!.map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const fg = lum(getComputedStyle(ti).color), bg = lum(getComputedStyle(bx).backgroundColor);
      return { edge: getComputedStyle(bx).borderLeftWidth, edgeColor: getComputedStyle(bx).borderLeftColor, titleColor: getComputedStyle(ti).color, ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), w: getComputedStyle(ti).fontWeight, size: getComputedStyle(ti).fontSize };
    });
    expect(css.edge).toBe("4px");
    expect(css.edgeColor).toBe(css.titleColor);   // the one error red
    expect(css.ratio).toBeGreaterThanOrEqual(4.5);
    expect(css.size).toBe("17px");
    expect(Number(css.w)).toBeGreaterThanOrEqual(700);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (w === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1794-kitchen-declined-390x844.png" });
  });
}
