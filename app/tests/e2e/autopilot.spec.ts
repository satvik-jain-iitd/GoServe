// Story #53: autopilot. The step time is 300 ms in this build (playwright.config.ts). The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const tracker = (page: Page) => page.locator("[aria-current=step]");

test("S1 in airplane mode Autopilot plays the whole order story from local data, under an Offline demo banner", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the menu is saved for offline use
  const readsBefore = net.calls.orderReads.length;
  await context.setOffline(true);
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Offline demo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(tracker(page)).toHaveText("Delivered", { timeout: 8000 });
  await expect(page.getByText("Your order has been delivered.")).toBeVisible();
  expect(net.calls.status).toHaveLength(0);   // nothing was sent
  expect(net.calls.decide).toHaveLength(0);
  expect(net.calls.orderReads).toHaveLength(readsBefore);   // the live list was not read either
});

test("S1 the other screens follow the same local story: kitchen card, rider list, ops suggestion", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Autopilot" }).click();
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByText(/Order [0-9a-f]{8}/)).toBeVisible();
  await page.getByRole("button", { name: "Ops" }).click();
  await expect(page.getByText("AI suggests rider R2 (81%). The rule agrees.")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Sample numbers (offline demo).")).toBeVisible();
  await page.getByRole("button", { name: "Customer" }).click();
  await expect(tracker(page)).toHaveText("Delivered", { timeout: 8000 });
});

test("S1 tapping Autopilot again leaves the demo and clears the sample order", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Offline demo")).toBeVisible();
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Offline demo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S2 online, Autopilot moves the order by itself and each step is sent as the kitchen or the rider", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect.poll(() => net.calls.status.length, { timeout: 10000 }).toBe(6);
  expect(net.calls.status.map((c) => [c.body.action, c.body.actor, c.body.to_status ?? c.body.event])).toEqual([
    ["status", "kitchen", "accepted"], ["status", "kitchen", "preparing"], ["status", "kitchen", "ready"],
    ["status", "rider", "out_for_delivery"], ["event", "rider", "order.arriving"], ["status", "rider", "delivered"],
  ]);
  expect(net.calls.status.every((c) => c.body.order_id === ID && c.headers["x-gs-token"] === "demo-token")).toBe(true);
  await expect(page.getByText("Offline demo")).toHaveCount(0);
  await page.waitForTimeout(900);
  expect(net.calls.status).toHaveLength(6);   // it stops after Delivered
});

test("S2 online with no order, Autopilot says to place one first and sends nothing", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Place an order first.")).toBeVisible();
  await page.waitForTimeout(800);
  expect(net.calls.status).toHaveLength(0);
});

test("S2 tapping Autopilot again stops it", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect.poll(() => net.calls.status.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Autopilot" }).click();
  const seen = net.calls.status.length;
  await page.waitForTimeout(1000);
  expect(net.calls.status.length).toBe(seen);
});

test("S1 online but the server cannot be reached and there is no order: Autopilot plays the offline story", async ({ page, context }) => {
  test.setTimeout(40000);
  await setup(context, page);
  await context.route("https://test.supabase.co/rest/v1/orders**", (route) => route.abort());   // wifi on, internet dead
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Offline demo")).toBeVisible({ timeout: 15000 });   // the library retries a dead network for about 7 seconds first
  await expect(tracker(page)).toHaveText("Delivered", { timeout: 8000 });
});

test("S1 if the server cannot be reached while Autopilot runs, it falls back to the offline story", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await context.route("https://orders.test/**", (route) => route.abort());   // the network fails after the page is up
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Offline demo")).toBeVisible({ timeout: 5000 });
  await expect(tracker(page)).toHaveText("Delivered", { timeout: 8000 });
});

test("S2 online, a refused step (kill switch) stops Autopilot after one call and shows the reason", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.reply = { status: 503, body: { ok: false, error: "kill_switch", message: "Orders are paused. Please try again soon." } };
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect.poll(() => net.calls.status.length, { timeout: 5000 }).toBe(1);
  await page.waitForTimeout(1200);   // four more steps would have gone by
  expect(net.calls.status).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Autopilot" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Orders are paused. Please try again soon.")).toBeVisible();   // the reason stays on screen
});

test("S1 the offline story never asks the server for a decision, even if the phone could reach it", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await context.route("https://orders.test/**", (route) => route.abort());   // the first step fails, so the story goes offline
  const asked: string[] = [];
  page.on("request", (r) => { if (r.url().startsWith("https://orders.test") && (r.postData() ?? "").includes('"decide"')) asked.push(r.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "Autopilot" }).click();
  await expect(page.getByText("Offline demo")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Ops" }).click();
  await expect(page.getByText("AI suggests rider R2 (81%). The rule agrees.")).toBeVisible({ timeout: 8000 });
  expect(asked).toHaveLength(0);
});
