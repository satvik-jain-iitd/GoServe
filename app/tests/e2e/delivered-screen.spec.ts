// Story 1508 (board DL1, canvas 3 row 2ck; owner 14 Nov 2026): the delivered screen. The title is "Your order". The time stays small ("At your door 8:08 pm").
// A small line "4 min early" shows only when the food came before the promised time (orders.promised_at). No address. No Call the kitchen on a delivered order (story 1656).
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const at = (h: number, m: number, s = 0) => new Date(2026, 10, 14, h, m, s).toISOString();   // on the phone's own clock
const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const slip = (page: Page) => page.getByRole("region", { name: "Order, delivered" });
// The app opens an order that is still on its way; the delivered state comes live, the way a customer sees it.
async function delivered(context: Parameters<typeof setup>[0], page: Page, row: object, kitchens: object[] = KITCHEN) {
  const net = await setup(context, page, [order("out_for_delivery")]);
  net.state.kitchens = kitchens;
  await page.goto("/customer/");
  await expect(page.getByRole("list", { name: "Order progress" })).toBeVisible();
  net.push("UPDATE", { ...order("delivered", at(21, 30)), ...row });   // updated_at moved later (a later change): it is not the delivery time
  await expect(slip(page)).toBeVisible();
  return net;
}

test("D1 A delivered order: the title is Your order, At your door 8:08 pm as today and not in the big face, no address", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 8) });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your order");
  await expect(slip(page).getByText("At your door 8:08 pm")).toBeVisible();   // the delivery's own time, not the row's last change (9:30 pm)
  await expect(page.locator(".ui-eta-big")).toHaveCount(0);
  await expect(page.getByText("Flat 4, Green Park")).toHaveCount(0);
});

test("D2 Early: promised 8:12 pm, came at 8:08 pm, a line under the time says 4 min early", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) });
  const early = slip(page).getByText("4 min early", { exact: true });
  await expect(early).toBeVisible();
  const time = (await slip(page).getByText("At your door 8:08 pm").boundingBox())!;
  expect((await early.boundingBox())!.y).toBeGreaterThanOrEqual(time.y + time.height - 1);   // a line of its own, under the time
});

test("D3 On time or late: no early line, and the word late is never written", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 20), promised_at: at(20, 12) });
  await expect(slip(page).getByText("At your door 8:20 pm")).toBeVisible();
  await expect(page.getByText(/early|late/i)).toHaveCount(0);
});

test("D3b under one minute early counts as on time: no line", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 11, 30), promised_at: at(20, 12) });
  await expect(slip(page).getByText("At your door 8:11 pm")).toBeVisible();
  await expect(page.getByText(/early/i)).toHaveCount(0);
});

test("D4 No promised time is known: no early line, never a guessed number", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: null });
  await expect(slip(page).getByText("At your door 8:08 pm")).toBeVisible();
  await expect(page.getByText(/early/i)).toHaveCount(0);
});

test("D5 Buttons: Order again (story 1589; before: Back to menu) is filled, the only button, in view at 360 by 640 with no scroll, no Call the kitchen (story 1656)", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) });
  const back = page.locator(".ui-bottom .ui-btn").last();
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveCount(0);
  await expect(page.locator(".ui-bottom > .ui-btn")).toHaveCount(1);
  await expect(back).toBeInViewport({ ratio: 1 });
  await expect(back).not.toHaveClass(/ghost/);
  await expect(back).toHaveText(/Order again ›/);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

test("D6 a kitchen with no phone: only the Order again button", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) }, [{ ...KITCHEN[0], phone: null }]);
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveCount(0);
  await expect(page.locator(".ui-bottom > .ui-btn")).toHaveCount(1);   // story 1589: the note line under it is not a button
  await expect(page.locator(".ui-bottom").getByRole("button", { name: /Order again ›/ })).toBeVisible();
});

// The reviewer's ask on PR #1511: the status box keeps its rows and times (story 1507) on a delivered order, and the last row shows its own time, not "Now".
test("D7 A delivered order: the last step row, Delivered, shows the time of the delivery, and no row says Now", async ({ page, context }) => {
  const ev = (event: string, when: string) => ({ id: `e-${event}`, order_id: ID, kitchen_id: "k", session_id: SESSION, event, actor: "rider", created_at: when });
  const net = await setup(context, page, [order("out_for_delivery")]);
  net.state.kitchens = KITCHEN;
  net.state.events = [ev("order.ready", at(19, 55)), ev("order.picked_up", at(19, 58))];
  await page.goto("/customer/");
  const list = page.getByRole("list", { name: "Order progress" });
  await expect(list.getByRole("listitem").filter({ hasText: "On the way" })).toHaveText("On the wayNow");
  net.state.events = [...net.state.events, ev("order.delivered", at(20, 8))];
  net.push("UPDATE", { ...order("delivered", at(21, 30)), delivered_at: at(20, 8), promised_at: at(20, 12) });
  await expect(slip(page)).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: "Delivered" })).toHaveText("Delivered8:08 pm");
  await expect(list.getByRole("listitem").filter({ hasText: "On the way" })).toHaveText("On the way7:58 pm");
  await expect(list.getByText("Now")).toHaveCount(0);
});
