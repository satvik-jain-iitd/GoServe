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
const box = (page: Page, sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
export function historyOrderAgain() {
  test.describe("the list", () => {
    const ORDERS = [
      past(1, "delivered", "2020-11-12T14:00:00Z", THALI_ROTI),
      past(2, "cancelled", "2020-11-10T14:00:00Z", [["d1", "Paneer Thali", 1]]),
      past(3, "delivered", "2020-11-13T14:00:00Z", [["d1", "Veg Thali", 1]], { kitchen_id: "k-2" }),
      past(4, "delivered", "2020-11-14T14:00:00Z", [["d1", "Dal Makhani", 1]], { kitchen_id: undefined }),
    ];
    test("a delivered row has one Order again button and no tag; a cancelled row has none; a row is 44 px tall or more (story 1738)", async ({ page, context }) => {
      await history(page, context, ORDERS);
      await expect(page.locator(".ui-order-row")).toHaveCount(4);
      await expect(page.locator(".ui-tag")).toHaveCount(0);
      await expect(page.locator(".ui-order-row", { hasText: "Paneer Thali" }).getByRole("button", { name: "Order again", exact: true })).toHaveCount(0);   // AC-1
      await expect(page.getByRole("button", { name: "Order again", exact: true })).toHaveCount(3);
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

  // Story 1676: no Order it again block on the opened order (delivered-no-again.spec.ts); the block cases move to story 1738, on the History list.


  // Story 1738: Order again is a small outline button on each delivered row. The four states of what today's menu can do keep every box where it is (rule 23).
  const STATES: Record<string, (s: any) => void> = {
    all: () => undefined,
    some: (s) => { s.menu = [dish("d1", "Veg Thali", 18000)]; },
    none: (s) => { s.menu = [dish("d9", "Dal Makhani", 20000)]; },
    closed: (s) => { s.kitchens = [{ ...s.kitchens[0], open: false }, K2]; },
  };
  const again = (page: Page) => page.getByRole("button", { name: "Order again", exact: true });
  const openList = (page: Page, context: Ctx, tune?: (s: any) => void) => history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", THALI_ROTI)], tune);
  const PARTS = [".ui-order-row", ".ui-order-open", ".ui-order-row .ui-btn"];
  test.describe("the row button", () => {
    for (const [key, tune] of Object.entries(STATES)) {
      test(`state ${key}: the button says Order again only (no amount, no count, no arrow) and is ${key === "closed" ? "disabled" : "enabled"}`, async ({ page, context }) => {
        await openList(page, context, tune);
        await expect(again(page)).toHaveText("Order again");
        await expect(again(page)).not.toContainText(/[₹›]|\d/);   // AC-4
        if (key === "closed") await expect(again(page)).toBeDisabled(); else await expect(again(page)).toBeEnabled();
      });
      test(`state ${key}: at 360x640 the button is in view, at least 44 px high, and the page does not scroll sideways`, async ({ page, context }) => {
        await page.setViewportSize({ width: 360, height: 640 });
        await openList(page, context, tune);
        await expect(again(page)).toBeInViewport({ ratio: 1 });
        expect((await again(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);   // AC-2
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
    }
    test("rule 23: nothing moves between the four states (boxes laid over each other)", async ({ page, context }) => {
      const seen: Record<string, Record<string, number[][]>> = {};
      for (const [key, tune] of Object.entries(STATES)) {
        await openList(page, context, tune);
        seen[key] = {};
        for (const p of PARTS) seen[key][p] = await box(page, p);
        await page.unrouteAll({ behavior: "ignoreErrors" });
      }
      for (const key of ["some", "none", "closed"]) for (const p of PARTS) expect(seen[key][p], `${key} ${p}`).toEqual(seen.all[p]);
    });
    test("the tap fills the bag with the dishes made today and opens the Bill, and does not open the order page", async ({ page, context }) => {
      await openList(page, context, STATES.some);
      await again(page).click();
      await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
      await expect(page.getByText("Veg Thali").first()).toBeVisible();
      await expect(page.getByText("Butter Roti")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Order, delivered" })).toHaveCount(0);
    });
    test("nothing made today: the tap opens the menu, not the Bill", async ({ page, context }) => {
      await openList(page, context, STATES.none);
      await again(page).click();
      await expect(page.getByRole("button", { name: "Add Dal Makhani" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
    });
    test("a tap on the rest of the row opens the order page", async ({ page, context }) => {
      await openList(page, context);
      await page.getByRole("button", { name: /Veg Thali/ }).first().click();
      await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
    });
    test("an order of another kitchen: the veg marks are read on the tap, not before, and the dishes are matched by name and mark", async ({ page, context }) => {
      const marks: string[] = [];
      page.on("request", (r) => { if (r.url().includes("/rest/v1/menu_items") && r.url().includes("id=in.")) marks.push(r.url()); });
      await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", [["old-1", "Veg Thali", 1], ["old-2", "Butter Roti", 1]], { kitchen_id: "k-2" })], (s) => { s.oldDishes = [{ id: "old-1", veg: true }, { id: "old-2", veg: false }]; });
      await page.waitForTimeout(300);
      expect(marks).toHaveLength(0);
      await again(page).click();
      await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
      expect(marks.length).toBeGreaterThan(0);
      await expect(page.getByText("Veg Thali").first()).toBeVisible();
      await expect(page.getByText("Butter Roti")).toHaveCount(0);   // the veg mark differs: not the same dish
    });
    test("an order of another kitchen: the row opens its page and the slip shows that kitchen", async ({ page, context }) => {
      await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", [["old-1", "Veg Thali", 1], ["old-2", "Butter Roti", 1]], { kitchen_id: "k-2" })], (s) => { s.oldDishes = [{ id: "old-1", veg: true }, { id: "old-2", veg: false }]; });
      await page.getByRole("button", { name: /Veg Thali/ }).first().click();
      await expect(page.locator(".ui-slip-head")).toContainText("Saket Kitchen");   // the order's own kitchen, never the present one
    });
    test("the dishes' marks cannot be read: no match, the tap opens the menu and never the Bill", async ({ page, context }) => {
      await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", [["old-1", "Veg Thali", 1]], { kitchen_id: "k-2" })], (s) => { s.oldDishesDown = true; });
      await again(page).click();
      await expect(page.getByRole("button", { name: "Add Veg Thali" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
    });
    test("a cancelled and a declined order have no Order again button", async ({ page, context }) => {
      await history(page, context, [past(1, "cancelled", "2020-11-12T14:00:00Z", THALI_ROTI), past(3, "cancelled", "2020-11-10T14:00:00Z", [["d1", "Roti", 1]], { cancelled_by: "kitchen", cancel_reason: "Out" })]);
      await expect(again(page)).toHaveCount(0);
    });
    test("a long dish list is cut with dots and the button keeps its size (AC-6)", async ({ page, context }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await openList(page, context);
      const short = (await again(page).boundingBox())!;
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await history(page, context, [past(1, "delivered", "2020-11-12T14:00:00Z", Array.from({ length: 9 }, (_, i) => ["d1", `Extra long dish name number ${i}`, 1] as [string, string, number]))]);
      const long = (await again(page).boundingBox())!;
      for (const k of ["x", "width", "height"] as const) expect(Math.abs(long[k] - short[k])).toBeLessThanOrEqual(1);
      expect(await page.locator(".ui-order-items").evaluate((e) => ({ over: e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight, ell: getComputedStyle(e).textOverflow }))).toMatchObject({ over: true });
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
