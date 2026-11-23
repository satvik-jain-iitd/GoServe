// Story 1712: the kitchen's cash hand-over asks in our own sheet, never a browser dialog. Not now left, Confirm hand-over last on the right, equal halves, nothing red.
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const DELIVERED = { ...order("delivered", new Date(2026, 9, 23, 23, 30).toISOString(), new Date(2026, 9, 23, 23, 0).toISOString()), rider_id: SESSION, kitchen_id: "k-1", customer_name: "Rahul Verma" };
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];

async function open(page: Page, context: Parameters<typeof setup>[0]) {
  await page.clock.install({ time: new Date(2026, 9, 23, 23, 50) });
  const net = await setup(context, page, [DELIVERED]);
  net.state.kitchen = "k-1";
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  let native = 0;
  page.on("dialog", (d) => { native++; void d.dismiss(); });
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Confirm hand-over Amit Kumar" }).click();
  return { net, native: () => native, sheet: page.getByRole("dialog") };
}
const sends = (net: { calls: { rpc: { name: string }[] } }) => net.calls.rpc.filter((c) => c.name === "kitchen_handover").length;

for (const size of SIZES) {
  test(`sheet, not a browser dialog; two equal halves on one line at ${size.width}x${size.height}`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const { sheet, native } = await open(page, context);
    await expect(sheet).toContainText("₹640");
    await expect(sheet).toContainText("Amit Kumar");
    await page.waitForTimeout(600);   // the sheet slides up first
    const l = await sheet.getByRole("button", { name: "Not now" }).boundingBox();
    const r = await sheet.getByRole("button", { name: "Confirm hand-over", exact: true }).boundingBox();
    expect(Math.abs(l!.width - r!.width)).toBeLessThan(1);
    expect(Math.abs(l!.height - r!.height)).toBeLessThan(1);
    expect(Math.abs(l!.y - r!.y)).toBeLessThan(1);
    expect(r!.x).toBeGreaterThan(l!.x);
    expect(native()).toBe(0);
    if (size.width === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1712-handover-sheet-390x844.png" });
  });
}

test("Not now closes it and sends nothing; the safe button has focus", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await expect(sheet.getByRole("button", { name: "Not now" })).toBeFocused();
  await sheet.getByRole("button", { name: "Not now" }).click();
  await expect(sheet).toHaveCount(0);
  expect(sends(net)).toBe(0);
});

test("Escape, a tap outside and phone Back close it and send nothing", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm hand-over Amit Kumar" }).click();
  await page.mouse.click(5, 5);
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm hand-over Amit Kumar" }).click();
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  expect(sends(net)).toBe(0);
});

test("Confirm hand-over sends it once", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await sheet.getByRole("button", { name: "Confirm hand-over", exact: true }).click();
  await expect.poll(() => sends(net)).toBe(1);
  await expect(sheet).toHaveCount(0);
});
