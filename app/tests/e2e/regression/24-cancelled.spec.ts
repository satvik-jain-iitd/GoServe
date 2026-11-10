// Regression, screen 24: T1 Cancelled order. Cases: .claude/handoff/qa/screens/24-T1-Cancelled.md (epic #1196, story #1197). Reached with the shared step STEPS["cancelled"].
// Where the case needs a different order (cancelled by the kitchen), the test answers the same REST read again after the step (a later route wins) and reloads the page. The step is still the only way in.
import { test, expect, type Route } from "@playwright/test";
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

test("TC 24.1 Look: the red Cancelled stamp, the lines, Nothing to pay Rs 0, the cancelled line, Order again", async ({ page, context }) => {
  await STEPS["cancelled"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Cancelled", exact: true })).toBeVisible();   // proves the cancelled screen shows before the slip is checked
  const stamp = page.locator(".ui-stamp", { hasText: "Cancelled" });
  await expect(stamp).toBeVisible();
  const color = await stamp.evaluate((el) => getComputedStyle(el).color);
  const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  expect(r, `stamp colour ${color}`).toBeGreaterThan(g);   // red: the red channel leads
  expect(r, `stamp colour ${color}`).toBeGreaterThan(b);
  await expect(page.locator(".ui-slip-lines")).toContainText("2 × Butter Chicken");
  const total = page.locator(".ui-slip-total");
  await expect(total).toContainText("Nothing to pay");
  await expect(total).toContainText("₹0");
  await expect(total).not.toContainText("Cash at door");   // the total is live (shown above), so the absence means something
  await expect(page.getByRole("status").filter({ hasText: "Your order was cancelled. Nothing to pay." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Order again", exact: true })).toBeVisible();
});

test("TC 24.2 Order again: the Bill opens with the same dishes at today's prices", async ({ page, context }) => {
  await STEPS["cancelled"](context, page, PATH);
  await expect(page.getByRole("button", { name: "Order again", exact: true })).toBeVisible();   // proves the button shows before the tap
  await page.getByRole("button", { name: "Order again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(page.getByText("₹640").first()).toBeVisible();   // 2 x 320 at today's price
});

test("TC 24.3 Cancelled by me says Cancelled; cancelled by the kitchen says Declined with the reason", async ({ page, context }) => {
  // Me: the step's order is cancelled by the customer (no kitchen reason on it).
  await STEPS["cancelled"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Cancelled", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toHaveCount(0);
  // Kitchen: the same order, cancelled by the kitchen with a reason. The orders read answers it, then the page starts again and the order is opened from History.
  const reason = "We are out of butter chicken tonight, so this order cannot be made.";
  await context.route(isPath("/rest/v1/orders"), (r) => answer(r, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancelled_by: "kitchen", cancel_reason: reason }]));
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toBeVisible();   // proves the kitchen's slip shows
  await expect(page.getByRole("heading", { name: "Cancelled", exact: true })).toHaveCount(0);
  await expect(page.locator(".ui-slip-stamp")).toContainText("Declined");
  await expect(page.locator(".ui-slip-total")).toContainText("Nothing to pay");
  await expect(page.getByRole("status").filter({ hasText: reason })).toBeVisible();
});

// TC 24.4 Drift (the board also has Call the kitchen) is parked in the case file: not automated.
