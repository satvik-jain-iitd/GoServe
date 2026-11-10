// Regression, screen 27: H1 Your orders (History). Cases: .claude/handoff/qa/screens/27-H1-History.md (epic #1196, story #1197). Reached with the shared step STEPS["orders"].
// The step opens History with no orders. Each test then answers the orders read again (a later route wins) and reaches History again: through the empty screen's See the menu and the History tab,
// or, where the case also needs a fresh menu, by a reload. A reload is only used with no open order on the list, because an open order sends the app to its tracker on load.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { order } from "../helpers";

const PATH = "/customer/";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const isPath = (path: string) => (url: URL) => url.pathname === path;
// Answers a REST read (and the browser's preflight); any write goes to the shared step's own answer.
async function answer(route: Route, body: unknown) {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  if (req.method() !== "GET") return route.fallback();
  return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}

// The order number is the first eight characters of the id, so each id starts with its own number: order n shows as No. num(n).
const num = (n: number) => (0xa0000000 + n).toString(16);
const oid = (n: number) => `${num(n)}-0000-4000-8000-000000000000`;
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const line = (menu_item_id: string, name: string, qty: number, price_paise: number) => ({ menu_item_id, name, qty, price_paise });
const past = (n: number, status: string, hours: number, items: object[], total_paise: number) => ({ ...order(status, ago(hours), ago(hours)), id: oid(n), items, total_paise });

const BUTTER_CHICKEN = line("m-bc", "Butter Chicken", 2, 32000);
const THALI_ROTI = [line("m-thali", "Veg Thali", 1, 18000), line("m-roti", "Roti", 2, 2500)];
// Today's menu for Order again: the thali and the roti are on it at today's prices.
const dish = (id: string, name: string, price_paise: number) => ({ id, name, price_paise, category: "Mains", veg: true, available: true, image_url: null, image_credit: null, description: null });
const MENU = [dish("m-thali", "Veg Thali", 18000), dish("m-roti", "Roti", 2500), dish("m-bc", "Butter Chicken", 32000)];

// Four orders, one per status. Order 1 is the newest; the list hands them over out of order and the app must still show newest first.
const ON_WAY = past(1, "out_for_delivery", 1, [BUTTER_CHICKEN], 64000);
const DELIVERED = past(2, "delivered", 3, THALI_ROTI, 23000);
const CANCELLED = past(3, "cancelled", 5, [BUTTER_CHICKEN], 64000);
const PLACED = past(4, "placed", 7, [line("m-bc", "Butter Chicken", 1, 32000)], 32000);
const FOUR = [CANCELLED, ON_WAY, PLACED, DELIVERED];

// The shared step, the orders read answered with `orders`, then History again. `menu` answers the menu too and reloads, so Order again sees it.
async function openHistory(context: BrowserContext, page: Page, orders: object[], menu?: object[]) {
  await STEPS["orders"](context, page, PATH);   // History, empty
  await context.route(isPath("/rest/v1/orders"), (r) => answer(r, orders));
  await page.getByRole("button", { name: "See the menu" }).click();   // the empty screen's way to the menu, then the tab back to History
  if (menu) {
    await context.route(isPath("/rest/v1/menu_items"), (r) => answer(r, menu));
    await page.reload();   // the menu is read once on load: the page starts again with the same orders
  }
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
}

test("TC 27.1 Look: History with 4 orders, newest first, No. and time, dishes, kitchen and price, status chip, Order again on the delivered row", async ({ page, context }) => {
  await openHistory(context, page, FOUR);
  const rows = page.getByRole("button", { name: /^No\. / });
  await expect(rows).toHaveCount(4);   // the list is live before its rows are checked
  await expect(rows.nth(0)).toContainText(`No. ${num(1)} · `);
  await expect(rows.nth(1)).toContainText(`No. ${num(2)} · `);
  await expect(rows.nth(2)).toContainText(`No. ${num(3)} · `);
  await expect(rows.nth(3)).toContainText(`No. ${num(4)} · `);
  await expect(rows.nth(0)).toContainText(/· (today|yesterday|\d{1,2} [A-Za-z]{3}) \d{1,2}:\d{2} (am|pm)/);
  await expect(rows.nth(0)).toContainText("2 × Butter Chicken");
  await expect(rows.nth(1)).toContainText("1 × Veg Thali, 2 × Roti");
  await expect(rows.nth(0)).toContainText("Hauz Khas Kitchen · ₹640");
  await expect(rows.nth(1)).toContainText("Hauz Khas Kitchen · ₹230");
  await expect(rows.nth(2)).toContainText("Hauz Khas Kitchen · ₹0");   // cancelled: nothing owed
  await expect(page.getByText(/^(Placed|On the way|Delivered|Cancelled)$/)).toHaveText(["On the way", "Delivered", "Cancelled", "Placed"]);
  const again = page.getByRole("button", { name: /^Order again, No\./ });
  await expect(again).toHaveCount(1);   // only the delivered row has it
  await expect(again).toHaveAccessibleName(`Order again, No. ${num(2)}`);
  await expect(page.getByText("Newest first")).toBeVisible();
});

test("TC 27.2 No orders: No orders yet, Your orders will show here., See the menu", async ({ page, context }) => {
  await STEPS["orders"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();   // shown once the read has finished with nothing in it
  await expect(page.getByText("Your orders will show here.")).toBeVisible();
  await expect(page.getByRole("button", { name: "See the menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^No\. / })).toHaveCount(0);
});

test("TC 27.3 Tap a row: that order opens (the delivered slip)", async ({ page, context }) => {
  await openHistory(context, page, FOUR);
  const rows = page.getByRole("button", { name: /^No\. / });
  await expect(rows).toHaveCount(4);   // the list is live before a row is tapped
  await rows.nth(1).click();   // No. a0000002, the delivered order
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible();
  await expect(page.locator(".ui-slip-lines")).toContainText("Veg Thali");
  await expect(page.locator(".ui-slip-lines")).toContainText("Roti");
  await expect(page.locator(".ui-slip-lines")).not.toContainText("Butter Chicken");   // another order's dish is not on this slip
});

test("TC 27.4 Order again: the Bill opens with those dishes at today's prices", async ({ page, context }) => {
  // Only the delivered order on the list: no open order, so the reload does not send the app to a tracker.
  await openHistory(context, page, [DELIVERED], MENU);
  const again = page.getByRole("button", { name: `Order again, No. ${num(2)}` });
  await expect(again).toBeVisible();   // proves the button shows before the tap
  await again.click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Veg Thali").first()).toBeVisible();
  await expect(page.getByText("Roti").first()).toBeVisible();
  await expect(page.getByText("₹230").first()).toBeVisible();   // 180 + 2 x 25 at today's prices
  await expect(page.getByText("Butter Chicken")).toHaveCount(0);   // not in this order, so not in the bill
  await expect(page.getByRole("status").filter({ hasText: "not on the menu today" })).toHaveCount(0);
});

test("TC 27.5 50 orders: the list scrolls down to the last order, nothing jumps, nothing is lost", async ({ page, context }) => {
  const MANY = Array.from({ length: 50 }, (_, i) => past(i + 1, "delivered", i + 1, [line("m-thali", "Veg Thali", 1, 18000)], 18000));
  await openHistory(context, page, MANY);
  const rows = page.getByRole("button", { name: /^No\. / });
  await expect(rows).toHaveCount(50);   // all 50 are in the list
  await expect(rows.nth(0)).toContainText(`No. ${num(1)} · `);
  await expect(rows.nth(49)).toContainText(`No. ${num(50)} · `);
  await expect(rows.nth(49)).not.toBeInViewport();   // the oldest is off the screen at first, so the list must scroll
  await rows.nth(49).scrollIntoViewIfNeeded();
  await expect(rows.nth(49)).toBeInViewport();
  await expect(page.getByText("Newest first")).toBeInViewport();   // the footer at the very end of the list
  await expect(rows).toHaveCount(50);   // no row added or lost on the way down
  await expect(rows.nth(0)).toContainText(`No. ${num(1)} · `);   // the top row is still the newest
  await expect(page.getByRole("button", { name: /^Order again, No\./ })).toHaveCount(50);
});
