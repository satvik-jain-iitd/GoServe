// Story 1666 (epic 1652), board k1rider (owner, 21 Nov 2026): with the Kitchen handoff code switch on, a Ready order alone shows "Code for the kitchen"
// under the slip and no Picked up button; the kitchen types the code and the order goes On the way by itself. Switch off: as today. The rpcs are mocked here.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const KITCHEN = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const mine = (status = "ready") => ({ ...order(status, NOW), rider_id: SESSION, customer_name: "Customer 1", address: "House 1, Lajpat Nagar II" });
type Code = { status: number; body: unknown };
const GOOD: Code = { status: 200, body: { ok: true, role: "rider", pickup_code: "6138" } };

async function open(context: BrowserContext, page: Page, on: boolean | "down", code: Code = GOOD, status = "ready") {
  const net = await setup(context, page, [mine(status)]);
  net.state.kitchens = KITCHEN;
  net.state.pickupOn = on;
  const reads: string[] = [];
  await context.route("**/rest/v1/rpc/order_code_v1*", async (route) => { reads.push(route.request().postData() ?? ""); await route.fulfill({ status: code.status, contentType: "application/json", body: JSON.stringify(code.body) }).catch(() => {}); });
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Pick up" })).toBeVisible();
  return { net, reads };
}
const box = (page: Page) => page.getByTestId("pickup-code");
const pickedUp = (page: Page) => page.locator(".ui-bottom button").filter({ hasText: /^Picked up$/ });

test("PC1 switch on: the code shows under the slip as text, the two lines of the frame show, and there is no Picked up button", async ({ page, context }) => {
  await open(context, page, true);
  await expect(box(page)).toBeVisible();
  await expect(box(page)).toContainText("Code for the kitchen");
  const digits = box(page).getByText("6138", { exact: true });
  await expect(digits).toBeVisible();
  expect(parseFloat(await digits.evaluate((e) => getComputedStyle(e).letterSpacing))).toBeGreaterThan(0);
  await expect(page.getByText("Tell this code to the kitchen.")).toBeVisible();
  await expect(page.getByText("The order goes On the way by itself.")).toBeVisible();
  await expect(pickedUp(page)).toHaveCount(0);
  expect(await page.title()).not.toContain("6138");
});

test("PC2 switch off: the screen is as today, Picked up and no code, and no code is read", async ({ page, context }) => {
  const { reads } = await open(context, page, false);
  await expect(pickedUp(page)).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByText("Tell this code to the kitchen.")).toHaveCount(0);
  expect(reads).toEqual([]);
});

test("PC3 a failed read of the code: today's screen stays (Picked up), no code box and no error text", async ({ page, context }) => {
  await open(context, page, true, { status: 500, body: { message: "boom" } });
  await expect(pickedUp(page)).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("PC4 the switch cannot be read: today's screen stays", async ({ page, context }) => {
  await open(context, page, "down");
  await expect(pickedUp(page)).toBeVisible();
  await expect(box(page)).toHaveCount(0);
});

test("PC5 the kitchen types the code: the order goes On the way by itself and the code leaves the screen", async ({ page, context }) => {
  const { net } = await open(context, page, true);
  await expect(box(page)).toBeVisible();
  net.push("UPDATE", mine("out_for_delivery"));
  await expect(page.getByRole("heading", { name: "On the way" })).toBeVisible();
  await expect(box(page)).toHaveCount(0);
});

for (const size of SIZES) {
  test(`PC6 at ${size.width} by ${size.height}: the code box is inside the slip's column, the lines wrap to two at most, no scroll`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await open(context, page, true);
    await expect(box(page)).toBeVisible();
    const slip = (await page.locator(".ui-slip").first().boundingBox())!;
    const b = (await box(page).boundingBox())!;
    expect(Math.abs(b.x - slip.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width - slip.width)).toBeLessThanOrEqual(1);
    expect(b.y).toBeGreaterThanOrEqual(slip.y + slip.height);
    const lines = await page.locator(".ui-bottom p").first().evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    expect(lines).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    if (size.width === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.worktrees/hc/.claude/handoff/dev/1666-rider-pickup-code-390x844.png" });
  });
}
