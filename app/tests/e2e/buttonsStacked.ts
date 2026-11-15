// Story 1572 (owner's pick B): on every order screen the bottom buttons stack, one per line, full width, in the DOM order. By measure, not by CSS text.
// Shared cases, run by Chromium (buttons-stacked.spec.ts) and by WebKit (buttons-stacked.webkit.spec.ts).
import { test, expect, type Page } from "@playwright/test";
import { setup, order } from "./helpers";

const STATES: [string, string, string[]][] = [
  ["placed", "placed", ["Cancel order", "Call the kitchen"]],
  ["accepted", "accepted", ["Cancel order", "Call the kitchen"]],
  ["out_for_delivery", "out for delivery", ["Call the rider"]],
  ["delivered", "delivered", ["Call the kitchen", "Back to menu"]],
  ["cancelled", "cancelled", ["Call the kitchen", "Back to menu"]],
  ["declined", "declined", ["Call the kitchen", "Order something else"]],
];

async function open(context: Parameters<typeof setup>[0], page: Page, key: string) {
  const live = key === "cancelled" ? "placed" : key === "delivered" ? "out_for_delivery" : key;   // an end slip is reached live, the way a customer sees it
  const net = await setup(context, page, key === "declined" ? [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancel_reason: "We are out of butter chicken tonight, so this order cannot be made." }] : [order(live)]);
  Object.assign(net.state.kitchens[0], { phone: "9876543210" });
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, updated_at: new Date().toISOString() };   // a rider point, so the on-the-way card and its call button show
  await page.goto("/customer/");
  if (key === "out_for_delivery") await expect(page.getByRole("link", { name: "Call the rider" })).toBeVisible();
  if (key === "declined") { await page.getByRole("button", { name: "History" }).click(); await page.getByRole("button", { name: /Butter Chicken/ }).click(); await expect(page.getByRole("heading", { name: "Declined" })).toBeVisible(); }
  else if (key === "cancelled") { await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible(); net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z")); await expect(page.getByText("Your order was cancelled")).toBeVisible(); }
  else if (key === "delivered") { await expect(page.locator('[aria-current="step"]')).toHaveText("On the wayNow"); net.push("UPDATE", order("delivered", "2020-01-01T10:09:00Z")); await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible(); }
}

export function buttonsStacked() {
  for (const [width, height] of [[360, 640], [390, 844], [412, 915]]) {
    for (const [key, label, names] of STATES) {
      test(`${label}: the bottom buttons are one per line, full width, in order (${width}x${height})`, async ({ page, context }) => {
        await page.setViewportSize({ width, height });
        await open(context, page, key);
        const btns = page.locator(".ui-bottom > .ui-btn");
        await expect(btns).toHaveCount(names.length);
        await expect(btns).toHaveText(names);   // the DOM order stays
        const b = await btns.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
        const col = await page.locator(".ui-bottom").evaluate((e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { l: r.x + parseFloat(s.paddingLeft), w: r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) }; });
        for (const r of b) { expect(Math.abs(r.x - col.l)).toBeLessThan(1); expect(Math.abs(r.w - col.w)).toBeLessThan(1); }   // the same left and the full width of the column
        for (let i = 1; i < b.length; i++) expect(b[i].y).toBeGreaterThanOrEqual(b[i - 1].y + b[i - 1].h - 0.5);   // each on its own line, none over another
        // Rule 11 (reviewer's call, 16 Nov 2026): the page never scrolls and the bar stays at the foot. At 360x640 only the inner pane scrolls (it already did by 31 px on Placed);
        // on the taller phones a screen that fits still fits. Story 1572, pick A: on the way only "Call the rider" stays; the kitchen is not called then.
        const s = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, win: window.innerHeight, foot: document.querySelector(".ui-bottom")!.getBoundingClientRect().bottom, over: document.querySelector(".ui-scroll")!.scrollHeight - document.querySelector(".ui-scroll")!.clientHeight }));
        expect(s.doc).toBeLessThanOrEqual(s.win);
        expect(Math.abs(s.foot - s.win)).toBeLessThan(1);
        if (height >= 844) expect(s.over).toBeLessThanOrEqual(0);
      });
    }
  }
}
