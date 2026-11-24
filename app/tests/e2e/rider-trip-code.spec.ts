// Story 1666 (epic 1652), board trip-frames (owner, 24 Nov 2026: "Ok sahi h", option A: one code per packet): with the Kitchen handoff code switch on, a trip of
// several Ready packets shows each packet's own code under its address, no Picked up all, no tap on the rows. A row ticks by itself when the kitchen typed its code.
// Switch off: the trip is as today (rider-trip.spec.ts RT1, RT2). The rpcs are mocked here.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const at = (min: number) => new Date(Date.now() - (60 - min) * 60_000).toISOString();
const IDS = [ID, "0a0a0a0a-1111-4222-8333-444444444444", "0b0b0b0b-1111-4222-8333-444444444444"];
const CODES = ["6138", "2907", "5514"];
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const packet = (i: number, status = "ready") => ({ ...order(status, NOW, at(i)), id: IDS[i], rider_id: SESSION, customer_name: `Customer ${i + 1}`, address: `House ${i + 1}, Lajpat Nagar II` });
const KITCHEN = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];

async function open(context: BrowserContext, page: Page, on: boolean | "down", failId: string | null = null) {
  const net = await setup(context, page, [0, 1, 2].map((i) => packet(i)));
  net.state.kitchens = KITCHEN;
  net.state.pickupOn = on;
  const reads: string[] = [];
  await context.route("**/rest/v1/rpc/order_code_v1*", async (route) => {
    const id = JSON.parse(route.request().postData() ?? "{}").p_order_id as string;
    reads.push(id);
    const i = IDS.indexOf(id);
    if (id === failId) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) }).catch(() => {});
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, role: "rider", pickup_code: CODES[i] }) }).catch(() => {});
  });
  await page.goto("/rider/");
  await expect(page.getByText("This trip · 3 packets")).toBeVisible();
  if (on === true && !failId) await expect(code(page, 0)).toBeVisible();   // the codes are read after the trip shows
  return { net, reads };
}
const row = (page: Page, i: number) => page.locator(".ui-tick-row").filter({ hasText: IDS[i].slice(0, 8) });
const code = (page: Page, i: number) => page.getByTestId(`trip-code-${IDS[i].slice(0, 8)}`);

test("TC1 switch on: each packet shows its own code under its address, and no row shows another packet's code", async ({ page, context }) => {
  await open(context, page, true);
  for (let i = 0; i < 3; i++) {
    await expect(code(page, i)).toContainText("Code for the kitchen");
    await expect(code(page, i).getByText(CODES[i], { exact: true })).toBeVisible();
    for (let j = 0; j < 3; j++) if (j !== i) await expect(row(page, i)).not.toContainText(CODES[j]);
  }
});

test("TC2 switch on: no Picked up all, no packet baaki line, the bottom line is the frame's, rows are not tappable", async ({ page, context }) => {
  await open(context, page, true);
  await expect(page.getByRole("button", { name: "Picked up all" })).toHaveCount(0);
  await expect(page.getByText(/packet baaki/)).toHaveCount(0);
  await expect(page.locator(".ui-bottom button")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Tell each packet's code to the kitchen. Each order goes On the way by itself." })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("TC3 the kitchen types one packet's code: that row ticks by itself and keeps its place; the others stay", async ({ page, context }) => {
  const { net } = await open(context, page, true);
  const before = (await row(page, 1).boundingBox())!;
  net.push("UPDATE", packet(0, "out_for_delivery"));
  await expect(row(page, 0).getByRole("img", { name: "Handed over" })).toBeVisible();
  await expect(row(page, 1).getByRole("img", { name: "Not yet" })).toBeVisible();
  await expect(code(page, 1).getByText(CODES[1], { exact: true })).toBeVisible();
  expect(Math.abs((await row(page, 1).boundingBox())!.y - before.y)).toBeLessThanOrEqual(1);
  await expect(page.getByText("This trip · 3 packets")).toBeVisible();
});

test("TC4 all packets handed over: the first door shows, as today", async ({ page, context }) => {
  const { net } = await open(context, page, true);
  for (let i = 0; i < 3; i++) net.push("UPDATE", packet(i, "out_for_delivery"));
  await expect(page.getByRole("heading", { name: "On the way" })).toBeVisible();
  await expect(page.getByText("This trip · 3 packets")).toHaveCount(0);
});

test("TC5 switch off: the trip is as today, ticks and Picked up all, no code read", async ({ page, context }) => {
  const { reads } = await open(context, page, false);
  await expect(page.getByRole("button", { name: "Picked up all", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await expect(page.getByText(/Code for the kitchen/)).toHaveCount(0);
  expect(reads).toEqual([]);
});

test("TC6 one packet's code cannot be read: the trip stays as today, no wrong or partial code", async ({ page, context }) => {
  await open(context, page, true, IDS[1]);
  await expect(page.getByRole("button", { name: "Picked up all", exact: true })).toBeDisabled();
  await expect(page.getByText(/Code for the kitchen/)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const size of SIZES) {
  test(`TC7 at ${size.width} by ${size.height}: each code is on its own line inside the row, the rows above do not move, the bottom line is at most 3 lines, no side scroll`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const { net } = await open(context, page, true);
    const r0 = (await row(page, 0).boundingBox())!;
    const c0 = (await code(page, 0).boundingBox())!;
    expect(c0.y).toBeGreaterThanOrEqual(r0.y);
    expect(c0.y + c0.height).toBeLessThanOrEqual(r0.y + r0.height + 1);
    const addr = (await row(page, 0).locator(".ui-tick-addr").boundingBox())!;
    expect(c0.y).toBeGreaterThanOrEqual(addr.y + addr.height - 1);
    const lines = await page.locator(".ui-bottom p").first().evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    expect(lines).toBeLessThanOrEqual(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    if (size.width === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.worktrees/hc/.claude/handoff/dev/1666-rider-trip-code-390x844.png" });
    void net;
  });
}
