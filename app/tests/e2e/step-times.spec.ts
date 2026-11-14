// Story 1507 (board ST1, canvas 3 row 2cj; owner 14 Nov 2026: "I want the time there"): in the order status box a finished step shows the time it happened
// ("7:42 pm", the time of the event, not the time the phone learned of it), the step now shows "Now", a step still to come shows nothing.
// The words stay ("Accepted", no name). Three rows and the slide of story 1324 stay; the box does not grow.
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const list = (page: Page) => page.getByRole("list", { name: "Order progress" });
const rowOf = (page: Page, words: string) => list(page).getByRole("listitem").filter({ hasText: words });
const at = (h: number, m: number) => new Date(2026, 10, 14, h, m, 0).toISOString();   // on the phone's own clock
const ev = (event: string, when: string) => ({ id: `e-${event}`, order_id: ID, kitchen_id: "k", session_id: SESSION, event, actor: "kitchen", created_at: when });
const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];

test("T1 A finished step shows its time: accepted at 7:42 pm and cooking, Accepted shows 7:42 pm, Cooking shows Now, Ready shows no time", async ({ page, context }) => {
  const net = await setup(context, page, [order("preparing")]);
  net.state.events = [ev("order.placed", at(19, 40)), ev("order.accepted", at(19, 42)), ev("order.preparing", at(19, 45))];
  await page.goto("/customer/");
  await expect(rowOf(page, "Accepted")).toHaveText("Accepted7:42 pm");
  await expect(rowOf(page, "Cooking")).toHaveText("CookingNow");
  await expect(rowOf(page, "Ready, rider picks up")).toHaveText("Ready, rider picks up");
  await expect(rowOf(page, "Accepted").locator(".mono")).toHaveText("7:42 pm");   // on the right, in the mono face
});

test("T2 A step with no known time: that row shows no time, never a wrong one", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.events = [ev("order.placed", at(19, 40)), ev("order.picked_up", at(20, 5))];   // this order moved on with no accepted, preparing or ready event
  await page.goto("/customer/");
  await expect(rowOf(page, "Ready, rider picks up")).toHaveText("Ready, rider picks up");
  await expect(rowOf(page, "On the way")).toHaveText("On the wayNow");
  await expect(list(page).getByRole("listitem")).toHaveText(["Ready, rider picks up", "On the wayNow", "At your door"]);   // the three rows in view: no time on any
});

test("T3 The time is the event's: a status that reaches the phone later still shows when it happened", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.events = [ev("order.accepted", at(19, 42))];
  await page.goto("/customer/");
  await expect(rowOf(page, "Accepted")).toHaveText("AcceptedNow");
  net.state.events = [ev("order.accepted", at(19, 42)), ev("order.preparing", at(19, 45))];
  net.push("UPDATE", order("preparing", "2020-01-01T10:03:00Z"));
  await expect(rowOf(page, "Cooking")).toHaveText("CookingNow");
  await expect(rowOf(page, "Accepted")).toHaveText("Accepted7:42 pm");
});

test("T4 The box does not grow: at 360 by 640 it has the same height with times as without, and every button is in view", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const net = await setup(context, page, [order("preparing")]);
  net.state.kitchens = KITCHEN;
  await page.goto("/customer/");
  await expect(rowOf(page, "Cooking")).toBeVisible();
  const plain = (await page.locator(".ui-roll").boundingBox())!.height;
  net.state.events = [ev("order.accepted", at(19, 42)), ev("order.preparing", at(19, 45))];
  await page.reload();
  await expect(rowOf(page, "Accepted")).toContainText("7:42 pm");
  expect((await page.locator(".ui-roll").boundingBox())!.height).toBe(plain);
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

test("T5 A failed read keeps the last known times", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.events = [ev("order.accepted", at(19, 42))];
  await page.goto("/customer/");
  await expect(rowOf(page, "Accepted")).toHaveText("AcceptedNow");
  net.state.eventsDown = true;
  net.push("UPDATE", order("preparing", "2020-01-01T10:03:00Z"));
  await expect(rowOf(page, "Cooking")).toHaveText("CookingNow");
  await expect(rowOf(page, "Accepted")).toHaveText("Accepted7:42 pm");
});

test("T6 the Cooking screen with a kitchen that has a phone: Call the kitchen is shown, Cancel order is not", async ({ page, context }) => {
  const net = await setup(context, page, [order("preparing")]);
  net.state.kitchens = KITCHEN;
  await page.goto("/customer/");
  await expect(rowOf(page, "Cooking")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveAttribute("href", "tel:9876543210");
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});
