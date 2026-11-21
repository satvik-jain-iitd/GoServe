// Story 1508 (board DL1, canvas 3 row 2ck; owner 14 Nov 2026): the delivered screen. The title is "Your order". The time stays small ("At your door 8:08 pm").
// Story 1739: no "early" line any more (it measured against a time the customer was never shown). No address. Call the kitchen above Back to menu.
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const at = (h: number, m: number, s = 0) => new Date(2026, 10, 14, h, m, s).toISOString();   // on the phone's own clock
const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const slip = (page: Page) => page.getByRole("region", { name: "Order, delivered" });
// The app opens an order that is still on its way; the delivered state comes live, the way a customer sees it.
async function delivered(context: Parameters<typeof setup>[0], page: Page, row: object, kitchens: object[] = KITCHEN, support: string | null = null) {
  const net = await setup(context, page, [order("out_for_delivery")]);
  net.state.kitchens = kitchens;
  net.state.supportPhone = support;
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

test("D2 Early: promised 8:12 pm, came at 8:08 pm (story 1739): no line with the word early, and the door time stays", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) });
  await expect(slip(page).getByText("At your door 8:08 pm")).toBeVisible();
  await expect(page.getByText(/early/i)).toHaveCount(0);
});

for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
  test(`D2b at ${size.width} by ${size.height} the At your door line has one place and size, whatever the promised time (story 1739)`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const net = await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) });
    const line = slip(page).getByText("At your door 8:08 pm");
    const read = async () => ({ box: (await line.boundingBox())!, font: await line.evaluate((e) => getComputedStyle(e).fontSize) });
    const early = await read();
    net.push("UPDATE", { ...order("delivered", at(21, 30)), delivered_at: at(20, 8), promised_at: null });
    await page.waitForTimeout(300);
    const none = await read();
    expect(none.font).toBe(early.font);
    for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(none.box[k] - early.box[k])).toBeLessThanOrEqual(0.5);
  });
}

test("D3 On time or late: no early line, and the word late is never written", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 20), promised_at: at(20, 12) });
  await expect(slip(page).getByText("At your door 8:20 pm")).toBeVisible();
  await expect(page.getByText(/early|late/i)).toHaveCount(0);
});

for (const [name, d, p] of [["under a minute early", at(20, 11, 30), at(20, 12)], ["33 minutes early", at(20, 0), at(20, 33)], ["exactly on time", at(20, 12), at(20, 12)]] as const) {
  test(`D3b ${name} (story 1739): no line with the word early`, async ({ page, context }) => {
    await delivered(context, page, { delivered_at: d, promised_at: p });
    await expect(slip(page).getByText(/^At your door/)).toBeVisible();
    await expect(page.getByText(/early/i)).toHaveCount(0);
  });
}

test("D4 No promised time is known: no early line, never a guessed number", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: null });
  await expect(slip(page).getByText("At your door 8:08 pm")).toBeVisible();
  await expect(page.getByText(/early/i)).toHaveCount(0);
});

test("D5 Buttons: Call support above Share feedback (story 1658; before: Call the kitchen above Order again), Share feedback filled and last, both in view at 360 by 640 with no scroll", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) }, KITCHEN, "9000000000");
  const call = page.getByRole("link", { name: "Call support" }), back = page.locator(".ui-bottom .ui-btn").last();
  await expect(call).toBeInViewport({ ratio: 1 });
  await expect(back).toBeInViewport({ ratio: 1 });
  expect((await call.boundingBox())!.y + (await call.boundingBox())!.height).toBeLessThanOrEqual((await back.boundingBox())!.y);
  await expect(back).not.toHaveClass(/ghost/);
  await expect(back).toHaveText("Share feedback");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

test("D6 no support number: only the Share feedback button, and never a call to the kitchen (story 1658)", async ({ page, context }) => {
  await delivered(context, page, { delivered_at: at(20, 8), promised_at: at(20, 12) });
  await expect(page.getByRole("link", { name: /Call/ })).toHaveCount(0);
  await expect(page.locator(".ui-bottom > .ui-btn")).toHaveCount(1);
  await expect(page.locator(".ui-bottom").getByRole("button", { name: "Share feedback" })).toBeVisible();
});

// The reviewer's ask on PR #1511: the status box keeps its rows and times (story 1507) on a delivered order, and the last row shows its own time, not "Now".
test("D7 A delivered order: no steps list (story 1675; before: Delivered row with the delivery time), and the door time still shows", async ({ page, context }) => {
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
  await expect(list).toHaveCount(0);
  await expect(slip(page).getByText("At your door")).toContainText("8:08 pm");
});
