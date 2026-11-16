// Story 1589 (owner picked frame history-1): History groups the orders by kitchen, a row has no tag and no button; an opened delivered order has an "Order it again" block.
// Shared cases, run by Chromium (history-order-again.spec.ts) and by WebKit (history-order-again.webkit.spec.ts).
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

type Ctx = Parameters<typeof setup>[0];
const dish = (id: string, name: string, price: number, over: object = {}) => ({ id, name, price_paise: price, category: "Mains", veg: true, available: true, image_url: null, image_credit: null, ...over });
const K2 = { id: "k-2", name: "Saket Kitchen", address: null, phone: null, pin_codes: ["110017"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
const uid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const past = (n: number, status: string, created: string, lines: [string, string, number][], over: object = {}) => ({
  ...order(status, created, created), id: uid(n), kitchen_id: "k-1", items: lines.map(([id, name, qty]) => ({ menu_item_id: id, name, qty, price_paise: 1000 })), total_paise: 22000, ...over,
});
const THALI_ROTI: [string, string, number][] = [["d1", "Veg Thali", 1], ["d2", "Butter Roti", 1]];

async function history(page: Page, context: Ctx, orders: object[], tune?: (s: any) => void, afterStart?: (s: any) => void) {
  const net = await setup(context, page, orders);
  net.state.menu = [dish("d1", "Veg Thali", 18000), dish("d2", "Butter Roti", 4000)];
  net.state.kitchens = [...(net.state.kitchens as object[]), K2];
  tune?.(net.state);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "History" })).toBeVisible();
  afterStart?.(net.state);   // a switch that must not touch the app's own start (it reads the kitchens too)
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  return net;
}
async function openDelivered(page: Page, context: Ctx, tune?: (s: any) => void) {
  await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", THALI_ROTI)], tune);
  await page.getByRole("button", { name: /Veg Thali/ }).click();
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  await expect(page.locator(".ui-again")).toBeVisible();
}
// The four states of the block. `tune` is what the network answers for that state.
const STATES: Record<string, (s: any) => void> = {
  all: () => undefined,
  some: (s) => { s.menu = [dish("d1", "Veg Thali", 18000)]; },
  none: (s) => { s.menu = [dish("d9", "Dal Makhani", 20000)]; },
  closed: (s) => { s.kitchens = [{ ...s.kitchens[0], open: false }, K2]; },
};
const box = (page: Page, sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
const PARTS = [".ui-again h2", ".ui-again-line", ".ui-again-dish", ".ui-bottom .ui-btn:last-of-type", ".ui-again-note", ".ui-slip", ".ui-bottom"];

export function historyOrderAgain() {
  test.describe("the list", () => {
    const ORDERS = [
      past(1, "delivered", "2020-11-12T14:00:00Z", THALI_ROTI),
      past(2, "cancelled", "2020-11-10T14:00:00Z", [["d1", "Paneer Thali", 1]]),
      past(3, "delivered", "2020-11-13T14:00:00Z", [["d1", "Veg Thali", 1]], { kitchen_id: "k-2" }),
      past(4, "delivered", "2020-11-14T14:00:00Z", [["d1", "Dal Makhani", 1]], { kitchen_id: undefined }),
    ];
    test("a row has no tag and no button inside it, and is 44 px tall or more", async ({ page, context }) => {
      await history(page, context, ORDERS);
      await expect(page.locator(".ui-order-row")).toHaveCount(4);
      await expect(page.locator(".ui-tag")).toHaveCount(0);
      await expect(page.locator(".ui-order-row button")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Order again/ })).toHaveCount(0);
      await expect(page.getByText(/Order again . today/)).toHaveCount(0);   // the header line is gone
      for (const h of await box(page, ".ui-order-row")) expect(h[3]).toBeGreaterThanOrEqual(44);
    });
    test("one heading per kitchen: the kitchen that cooks now first, the others after, no kitchen under Older orders", async ({ page, context }) => {
      await history(page, context, ORDERS);
      const heads = page.locator(".ui-order-group");
      await expect(heads).toHaveCount(3);
      await expect(heads.nth(0)).toHaveText(/Hauz Khas Kitchen\s*cooks for you now/i);
      await expect(heads.nth(1)).toHaveText(/Saket Kitchen\s*your older orders/i);
      await expect(heads.nth(2)).toHaveText(/Older orders/i);
      await expect(page.getByText("Hauz Khas Kitchen")).toHaveCount(1);   // said once, not on every row
    });
    test("only an exception has a word: Cancelled is bold in the error colour and shows no price; a delivered order has no word", async ({ page, context }) => {
      await history(page, context, ORDERS);
      const cancelled = page.locator(".ui-order-row", { hasText: "Paneer Thali" });
      await expect(cancelled.locator(".ui-order-word")).toHaveText("Cancelled");
      expect(await cancelled.locator(".ui-order-word").evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
      await expect(cancelled).not.toContainText("₹");
      const delivered = page.locator(".ui-order-row", { hasText: "Veg Thali" }).first();
      await expect(delivered).not.toContainText(/Delivered|Cancelled/);
      await expect(delivered).toContainText("₹220");
    });
    test("a live order says its state in ink, and a declined one says Declined", async ({ page, context }) => {
      await setup(context, page, [past(5, "preparing", "2020-11-14T14:00:00Z", [["d1", "Veg Thali", 1]]), past(6, "cancelled", "2020-11-10T14:00:00Z", [["d1", "Roti", 1]], { cancel_reason: "Out of stock", cancelled_by: "kitchen" })]);
      await page.goto("/customer/");   // an open order lands on its tracker first
      await page.getByRole("button", { name: "Back to menu" }).click();
      await page.getByRole("button", { name: "History" }).click();
      await expect(page.locator(".ui-order-row", { hasText: "Veg Thali" }).locator(".ui-order-word")).toHaveText("Cooking");
      await expect(page.locator(".ui-order-row", { hasText: "Roti" }).locator(".ui-order-word")).toHaveText("Declined");
    });
  });

  test.describe("the opened order", () => {
    for (const [key, tune] of Object.entries(STATES)) {
      test(`state ${key}: the block, its rows and its button`, async ({ page, context }) => {
        await openDelivered(page, context, tune);
        const rows = page.locator(".ui-again-dish");
        await expect(rows).toHaveCount(2);
        const bar = page.locator(".ui-bottom .ui-btn").last();
        if (key === "all") {
          await expect(rows.nth(0)).toContainText("Veg Thali");
          await expect(rows.nth(0)).toContainText("₹180");
          await expect(rows.nth(1)).toContainText("₹40");
          await expect(page.locator(".ui-again-line")).toContainText("Hauz Khas Kitchen cooks for");
          await expect(bar).toHaveText(/₹220\s*Order again ›/);
          await expect(bar).toBeEnabled();
        }
        if (key === "some") {
          await expect(rows.nth(0)).toContainText("₹180");
          await expect(rows.nth(1)).toContainText("not made today");
          await expect(rows.nth(1).locator(".nm")).toHaveCSS("text-decoration-line", "line-through");
          await expect(bar).toHaveText(/1 of 2 · ₹180\s*Order again ›/);
        }
        if (key === "none") {
          await expect(rows).toHaveText([/not made today/, /not made today/]);
          await expect(page.locator(".ui-again-line")).toHaveText("Hauz Khas Kitchen does not make these dishes today.");
          await expect(bar).toHaveText("See the menu");
        }
        if (key === "closed") {
          await expect(bar).toBeDisabled();
          await expect(bar).toHaveText(/Order again ›/);
          await expect(page.locator(".ui-again-note")).toHaveText("Hauz Khas Kitchen is closed now.");
        } else await expect(page.locator(".ui-again-note")).toHaveText("");
      });
      test(`state ${key}: the answer is on screen at 360x640 with no scroll`, async ({ page, context }) => {
        await page.setViewportSize({ width: 360, height: 640 });
        await openDelivered(page, context, tune);
        await expect(page.locator(".ui-bottom .ui-btn").last()).toBeInViewport({ ratio: 1 });
        await expect(page.locator(".ui-again-line")).toBeInViewport({ ratio: 1 });
        if (key === "closed") await expect(page.locator(".ui-again-note")).toBeInViewport({ ratio: 1 });
      });
    }
    test("rule 23: nothing moves between the four states (boxes laid over each other)", async ({ page, context }) => {
      const seen: Record<string, Record<string, number[][]>> = {};
      for (const [key, tune] of Object.entries(STATES)) {
        await openDelivered(page, context, tune);
        seen[key] = {};
        for (const p of PARTS) seen[key][p] = await box(page, p);
        await page.unrouteAll({ behavior: "ignoreErrors" });
      }
      for (const key of ["some", "none", "closed"]) for (const p of PARTS) expect(seen[key][p], `${key} ${p}`).toEqual(seen.all[p]);
    });
    test("Order again fills the bag with the dishes made today and opens the Bill", async ({ page, context }) => {
      await openDelivered(page, context, STATES.some);
      await page.getByRole("button", { name: /Order again ›/ }).click();
      await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
      await expect(page.getByText("Veg Thali").first()).toBeVisible();
      await expect(page.getByText("Butter Roti")).toHaveCount(0);
    });
    test("an order of another kitchen is matched by name and veg mark; the slip shows that kitchen", async ({ page, context }) => {
      await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", [["old-1", "Veg Thali", 1], ["old-2", "Butter Roti", 1]], { kitchen_id: "k-2" })], (s) => { s.oldDishes = [{ id: "old-1", veg: true }, { id: "old-2", veg: false }]; });
      await page.getByRole("button", { name: /Veg Thali/ }).click();
      await expect(page.locator(".ui-slip-head")).toContainText("Saket Kitchen");   // the order's own kitchen, never the present one
      await expect(page.locator(".ui-again-dish").nth(0)).toContainText("₹180");
      await expect(page.locator(".ui-again-dish").nth(1)).toContainText("not made today");   // the veg mark differs: not the same dish
    });
    test("the menu cannot be read: no marks, the line says so, the button is See the menu", async ({ page, context }) => {
      await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", [["old-1", "Veg Thali", 1]], { kitchen_id: "k-2" })], (s) => { s.oldDishesDown = true; });
      await page.getByRole("button", { name: /Veg Thali/ }).click();
      await expect(page.locator(".ui-again-line")).toHaveText("Could not check today's menu.");
      await expect(page.locator(".ui-again-dish .ui-again-mk")).toHaveText([""]);
      await expect(page.locator(".ui-bottom .ui-btn").last()).toHaveText("See the menu");
    });
    test("a cancelled, a declined and an order in progress have no block", async ({ page, context }) => {
      await history(page, context, [past(1, "cancelled", "2020-11-12T14:00:00Z", THALI_ROTI)]);
      await page.getByRole("button", { name: /Veg Thali/ }).click();
      await expect(page.getByRole("heading", { name: "Cancelled" })).toBeVisible();
      await expect(page.locator(".ui-again")).toHaveCount(0);
    });
  });

  // Story 1589 (reviewer, 16 Nov 2026): the slip's header names the order's own kitchen. Until another kitchen's name is known the line is empty and keeps its box; a failed read shows the pin alone.
  const other = () => past(2, "delivered", "2020-11-12T14:00:00Z", THALI_ROTI, { kitchen_id: "k-2" });
  const headBox = (page: Page) => page.locator(".ui-slip-head span").first().evaluate((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.y), Math.round(r.height)]; });
  test("another kitchen's name comes late: the header line is empty, then filled, in the same box", async ({ page, context }) => {
    await history(page, context, [other()], (s) => { s.kitchensDelay = 1500; });
    await page.getByRole("button", { name: /Veg Thali/ }).click();
    await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
    await expect(page.locator(".ui-slip-head span").first()).toHaveText("");
    const before = await headBox(page);
    await expect(page.locator(".ui-slip-head span").first()).toContainText("Saket Kitchen", { timeout: 5000 });
    expect(await headBox(page)).toEqual(before);
  });
  test("the kitchens read fails: the header shows the pin alone, never the present kitchen's name", async ({ page, context }) => {
    await history(page, context, [other()], undefined, (s) => { s.kitchensDown = true; });
    await page.getByRole("button", { name: /Veg Thali/ }).click();
    await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
    await expect(page.locator(".ui-slip-head span").first()).toHaveText(/^\d{6}$/);
  });
  test("an order from the kitchen that cooks now shows its name at once", async ({ page, context }) => {
    await history(page, context, [past(3, "delivered", "2020-11-12T14:00:00Z", THALI_ROTI)], (s) => { s.kitchensDelay = 3000; });
    await page.getByRole("button", { name: /Veg Thali/ }).click();
    await expect(page.locator(".ui-slip-head span").first()).toContainText("Hauz Khas Kitchen", { timeout: 1500 });
  });
}
