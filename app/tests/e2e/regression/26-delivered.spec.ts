// Regression, screen 26: Delivered. Cases: .claude/handoff/qa/screens/26-Delivered.md (epic #1196, story #1197). Reached with the shared step STEPS["orders"] (History).
// The case needs a delivered order in the history and a kitchen with a phone, which the shared step does not hold: the test answers the same REST paths again after the step
// (a later route wins), reloads the page and opens History again. The step is still the only way in.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { order } from "../helpers";

const PATH = "/customer/";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });   // the door time is read in India: 11:23 UTC is 4:53 pm

const isPath = (path: string) => (url: URL) => url.pathname === path;
// Answers a REST read (and the browser's preflight); any write goes to the shared step's own answer.
async function answer(route: Route, body: unknown) {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  if (req.method() !== "GET") return route.fallback();
  return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}

// Two lines: 2 x Butter Chicken at Rs 320 and 1 x Dal Makhani at Rs 190. Delivery is free, so the total is Rs 830.
const LINES = [
  { menu_item_id: "d2", name: "Butter Chicken", qty: 2, price_paise: 32000 },
  { menu_item_id: "d1", name: "Dal Makhani", qty: 1, price_paise: 19000 },
];
const DELIVERED = { ...order("delivered", "2026-11-10T11:23:00Z", "2026-11-10T10:40:00Z"), items: LINES, total_paise: 83000, paid_by: "cash" };
// The same order with a Rs 40 delivery fee in the total (the server's total carries the fee, so it is Rs 870).
const DELIVERED_FEE = { ...DELIVERED, total_paise: 87000 };
// The kitchen that holds the phone number the slip's Call the kitchen link uses (the same kitchen the bill spec uses).
const KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, opens_at: "00:00:00", closes_at: "23:59:00" };

// The shared step (History, no orders yet), then this history and kitchen, the same page again, and History opened.
async function reach(context: BrowserContext, page: Page, delivered: typeof DELIVERED = DELIVERED) {
  await STEPS["orders"](context, page, PATH);
  await context.route(isPath("/rest/v1/orders"), (r) => answer(r, [delivered]));
  await context.route(isPath("/rest/v1/kitchens"), (r) => answer(r, [KITCHEN]));
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("button", { name: /^No\. 0f0f0f0f/ })).toBeVisible();   // proves the delivered row shows before it is tapped
  await page.getByRole("button", { name: /^No\. 0f0f0f0f/ }).click();
}

test("TC 26.1 Look: the Delivered stamp, At your door 4:53 pm, the lines, Cash paid, the thank-you line and two buttons", async ({ page, context }) => {
  await reach(context, page);
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible();
  const slip = page.getByRole("region", { name: "Order, delivered" });
  await expect(slip).toBeVisible();
  await expect(slip.getByText("Delivered", { exact: true })).toBeVisible();   // the stamp
  await expect(slip.getByText("At your door 4:53 pm", { exact: true })).toBeVisible();
  await expect(slip.getByText("2 × Butter Chicken", { exact: true })).toBeVisible();
  await expect(slip.getByText("1 × Dal Makhani", { exact: true })).toBeVisible();
  await expect(slip.getByText("Cash paid", { exact: true })).toBeVisible();
  await expect(slip.getByText("₹830", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivered. Thank you for eating with GoServe.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "See the menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveAttribute("href", "tel:9876543210");
});

test("TC 26.2 Total equals the lines, free delivery: the lines plus Delivery Free add up to the Cash paid amount", async ({ page, context }) => {
  await reach(context, page);
  const slip = page.getByRole("region", { name: "Order, delivered" });
  await expect(slip.getByText("Cash paid", { exact: true })).toBeVisible();   // proves the slip shows before the sum is read
  const rows = slip.locator(".ui-slip-lines > div");
  await expect(rows).toHaveCount(3);   // two dishes and Delivery
  const amounts = await rows.locator("span:last-child").allTextContents();
  expect(amounts[2]).toBe("Free");   // no fee to add
  const sum = Number(amounts[0]) + Number(amounts[1]);
  expect(sum).toBe(830);   // the two lines as the customer reads them: 640 and 190
  await expect(slip.locator(".ui-slip-total span")).toHaveText(`₹${sum}`);
});

test("TC 26.2 Total equals the lines plus a delivery fee: the Delivery row adds up to the Cash paid amount", async ({ page, context }) => {
  await reach(context, page, DELIVERED_FEE);
  const slip = page.getByRole("region", { name: "Order, delivered" });
  await expect(slip.getByText("Cash paid", { exact: true })).toBeVisible();   // proves the slip shows before the sum is read
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹870");   // the server's total, with the fee in it
  const rows = slip.locator(".ui-slip-lines > div");
  await expect(rows).toHaveCount(3);   // two dishes and Delivery
  const amounts = await rows.locator("span:last-child").allTextContents();
  // The Delivery row is written as Free for every order (PlacedScreen.tsx:143), so the rows do not add up when a fee is charged.
  test.fail(true, "#1268: the Delivery row always reads Free (PlacedScreen.tsx:143) while the total carries the delivery fee, so the rows do not add up to Cash paid");
  expect(Number(amounts[0]) + Number(amounts[1]) + Number(amounts[2])).toBe(870);   // 640 + 190 + 40
});
