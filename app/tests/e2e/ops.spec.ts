// Story #51: the ops screen. The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, decisionOf, order, setup } from "./helpers";

const openOps = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ops" }).click();
  await expect(page.getByRole("heading", { name: "Ops" })).toBeVisible();
};

test("S1 a ready order gets a decision call and the screen shows the AI suggestion and the rule", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  await openOps(page);
  await expect(page.getByText("AI suggests rider R2 (81%). The rule agrees.")).toBeVisible({ timeout: 5000 });
  expect(net.calls.decide).toHaveLength(1);
  expect(net.calls.decide[0]).toMatchObject({ action: "decide", session_id: SESSION, order_id: ID });
  expect(net.calls.decide[0].riders.map((r: any) => r.id)).toEqual(["r1", "r2", "r3"]);
});

test("S1 an order that already has a decision is not asked again", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.decisions = [{ id: 1, order_id: ID, session_id: SESSION, created_at: "2020-01-01T10:00:00Z", decision: decisionOf({ jev: { pick: "r1", confidence: 0.77, agrees: false } }) }];
  await openOps(page);
  await expect(page.getByText("AI suggests rider R1 (77%). The rule picked R2.")).toBeVisible();
  expect(net.calls.decide).toHaveLength(0);
});

test("S1 an order that is not ready yet is not listed and not asked", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  await openOps(page);
  await expect(page.getByText("No ready orders yet.")).toBeVisible();
  expect(net.calls.decide).toHaveLength(0);
});

test("S1 a refused decision call shows the reason once and does not loop", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.reply = { status: 503, body: { ok: false, error: "kill_switch", message: "Orders are paused. Please try again soon." } };
  await openOps(page);
  await expect(page.getByRole("alert")).toHaveText("Orders are paused. Please try again soon.");
  await expect(page.getByText("No suggestion: Orders are paused. Please try again soon.")).toBeVisible();   // the slip says why
  net.push("UPDATE", order("ready", "2020-01-01T10:05:00Z"));   // an order change reruns the effect: the loop would start here
  await page.waitForTimeout(2500);
  expect(net.calls.decide).toHaveLength(1);
});

test("S2 the metrics panel shows time to this screen, decision time and runs today", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.runs = [{ workflow: "GS MAIN 01 Order API: decide", duration_ms: 420, created_at: new Date().toISOString() }];
  net.state.runCount = 7;
  await openOps(page);
  await expect(page.getByText("No live order seen yet.")).toBeVisible();
  net.push("INSERT", { ...order("placed"), created_at: new Date(Date.now() - 700).toISOString() });
  await expect(page.getByTestId("metric-lag")).toHaveText(/^\d+(\.\d)? s$|^\d+ ms$/, { timeout: 6000 });
  await expect(page.getByTestId("metric-decision")).toHaveText("420 ms");
  await expect(page.getByTestId("metric-runs")).toHaveText("7");
});

test("S2 the decision time is the last decide run even when more than 50 other runs came after it", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.runs = [...Array.from({ length: 60 }, () => ({ workflow: "GS MAIN 01 Order API: status", duration_ms: 90, created_at: new Date().toISOString() })),
    { workflow: "GS MAIN 01 Order API: decide", duration_ms: 420, created_at: new Date().toISOString() }];
  await openOps(page);
  await expect(page.getByTestId("metric-decision")).toHaveText("420 ms");
  await expect(page.getByTestId("metric-runs")).toHaveText("61");
});

test("S2 with no runs yet the panel says so instead of showing zeros as facts", async ({ page, context }) => {
  await setup(context, page);
  await openOps(page);
  await expect(page.getByTestId("metric-decision")).toHaveText("No decision yet.");
  await expect(page.getByTestId("metric-runs")).toHaveText("0");
});
