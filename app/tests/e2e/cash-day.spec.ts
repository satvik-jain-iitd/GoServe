// Story #229 (F147): the cash day ends at the kitchen's closing time, and the hand-over is one number on both screens. The network is answered by the test.
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m, 0);
const DELIVERED = { ...order("delivered", at(23, 23, 30).toISOString(), at(23, 23, 0).toISOString()), rider_id: SESSION, kitchen_id: "k-1", customer_name: "Rahul Verma" };

test("S1 a delivery at 23:30 is still in Cash in hand at 00:10 when the kitchen closes at 02:00", async ({ page, context }) => {
  await page.clock.install({ time: at(24, 0, 10) });
  const net = await setup(context, page, [DELIVERED]);
  Object.assign(net.state.kitchens[0], { opens_at: "18:00", closes_at: "02:00" });
  await page.goto("/rider/");
  await tab(page, "Today").click();
  await expect(page.getByText("1 delivered")).toBeVisible();
  await expect(page.getByTestId("cash")).toContainText("₹640");
  await expect(page.getByTestId("cash")).toContainText("day ends at 02:00");
  await expect(page.getByText(/No\. 0f0f0f0f/)).toBeVisible();
});

test("S1 the same delivery is yesterday's when the kitchen closes at 23:00", async ({ page, context }) => {
  await page.clock.install({ time: at(24, 0, 10) });
  const net = await setup(context, page, [DELIVERED]);
  Object.assign(net.state.kitchens[0], { opens_at: "10:00", closes_at: "23:00" });
  await page.goto("/rider/");
  await tab(page, "Today").click();
  await expect(page.getByText("No deliveries yet today")).toBeVisible();
  await expect(page.getByTestId("cash")).toContainText("₹0");
});

test("S2 the kitchen confirms the hand-over and both screens show the same cash", async ({ page, context }) => {
  await page.clock.install({ time: at(23, 23, 50) });
  const net = await setup(context, page, [DELIVERED]);
  net.state.kitchen = "k-1";
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  await page.goto("/kitchen/");
  await tab(page, "Today").click();
  const row = page.locator(".ui-row", { hasText: "Amit Kumar" });
  await expect(row).toContainText("₹640 in hand");
  const rider = await context.newPage();
  await rider.clock.install({ time: at(23, 23, 50) });
  await rider.goto("/rider/");
  await tab(rider, "Today").click();
  await expect(rider.getByTestId("cash")).toContainText("₹640");   // the same number the kitchen sees
  page.on("dialog", (d) => void d.accept());   // the confirm names the sum and the rider
  await page.getByRole("button", { name: "Confirm hand-over Amit Kumar" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "kitchen_handover").map((c) => c.body)).toEqual([{ p_rider: SESSION }]);
  net.state.orders = [{ ...DELIVERED, cash_handed_at: at(23, 23, 51).toISOString() }];
  await expect(row).toContainText("₹0 in hand");
  await expect(row).toContainText("₹640 handed over");
  await rider.reload();
  await tab(rider, "Today").click();
  await expect(rider.getByTestId("cash")).toContainText("₹0");
  await expect(rider.getByText("₹640 handed over")).toBeVisible();
});

test("S3 cash from an older day that was never handed over shows on the row before the Confirm stamps it", async ({ page, context }) => {
  await page.clock.install({ time: at(24, 20, 0) });
  const net = await setup(context, page, [{ ...DELIVERED, id: "0a0a0a0a-0000-0000-0000-000000000000" }, { ...DELIVERED, updated_at: at(24, 19, 30).toISOString() }]);   // yesterday's and today's
  net.state.kitchen = "k-1";
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  await page.goto("/kitchen/");
  await tab(page, "Kitchen").click();
  const row = page.locator(".ui-row", { hasText: "Amit Kumar" });
  await expect(row).toContainText("₹640 in hand · older: ₹640");
  page.on("dialog", (d) => { expect(d.message()).toContain("₹1280 (₹640 from older days)"); void d.dismiss(); });   // a No sends nothing
  await page.getByRole("button", { name: "Confirm hand-over Amit Kumar" }).click();
  await page.waitForTimeout(300);
  expect(net.calls.rpc.filter((c) => c.name === "kitchen_handover")).toHaveLength(0);
});
