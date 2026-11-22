// Story 1740 (owner, 20 Nov 2026): the customer app never asks "Was your order delivered?", on the screen or as a notice. The rider's Delivered is the truth.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ask = (page: Page) => page.getByText("Was your order delivered?");
const foot = (page: Page) => page.locator(".ui-bottom").evaluate((e) => Math.round(e.getBoundingClientRect().height));

async function placeOrder(page: Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}

async function open(page: Page, context: Parameters<typeof setup>[0], status: "ready" | "out_for_delivery", minutes: number) {
  await context.addInitScript(() => {
    (window as any).__notes = [];
    class Fake { static permission = "granted"; static requestPermission = async () => "granted"; constructor(t: string) { (window as any).__notes.push(t); } }
    (window as any).Notification = Fake;
  });
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 0.03, confirm_after_place_min: 8 };   // the old timing: the question would come within seconds
  await placeOrder(page);
  net.push("INSERT", order(status, ago(minutes), ago(minutes)));
  await page.waitForTimeout(3500);
  return net;
}

for (const [status, name] of [["ready", "AC-1 Ready"], ["out_for_delivery", "AC-2 On the way"]] as const) {
  test(`${name} for ten minutes: no "Was your order delivered?", no Not yet or Yes button, no notice, and the foot keeps its height`, async ({ page, context }) => {
    await open(page, context, status, 10);
    await expect(ask(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Not yet" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yes, I have it" })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__notes)).toEqual([]);
    expect(await foot(page)).toBeLessThan(140);   // AC-4 measured: the question card alone was about 120 px, the foot is the Call buttons only
  });
}

test("AC-3 the rider marks Delivered: the customer's screen shows Delivered", async ({ page, context }) => {
  const net = await open(page, context, "out_for_delivery", 10);
  net.push("UPDATE", order("delivered", ago(10), new Date().toISOString()));
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  await expect(ask(page)).toHaveCount(0);
});
