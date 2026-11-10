// Regression, screen 20: M2 Menu with items in the bill. Cases: .claude/handoff/qa/screens/20-M2.md (epic #1196, story #1197). Reached with the shared step STEPS["menu"].
// The shared menu holds one dish and the case needs two, so the test answers the menu's REST read again after the step and reloads the same page (as 10-menu-home does). The step is still the only way in.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const MENU = [
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Mains", available: true },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Mains", available: true },
];

const isMenu = (url: URL) => url.pathname === "/rest/v1/menu_items";
// Answers the menu read (and the browser's preflight); any write goes on to the shared step's own answer.
async function answer(route: Route, body: unknown) {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  if (req.method() !== "GET") return route.fallback();
  return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}
// The shared step, then the two dishes, then the same page again so the app reads them.
async function menuWithTwo(page: Page, context: BrowserContext) {
  await STEPS["menu"](context, page, PATH);
  await context.route(isMenu, (r) => answer(r, MENU));
  await page.reload();
  await expect(page.getByRole("button", { name: "Add Dal Makhani" })).toBeVisible();
}
const addBoth = async (page: Page) => {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: "Add Dal Makhani" }).click();
};

test("TC 20.1 Look: two dishes added, each row shows a stepper, the bill bar sits above the tabs, Delivery is the active tab", async ({ page, context }) => {
  await menuWithTwo(page, context);
  await addBoth(page);
  for (const name of ["Butter Chicken", "Dal Makhani"]) {
    const row = page.getByRole("article").filter({ hasText: name });
    await expect(row.getByRole("status", { name: `Quantity of ${name}` })).toHaveText("1");
    await expect(row.getByRole("button", { name: `Less ${name}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `Add ${name}` })).toHaveCount(0);
  }
  const bar = page.getByRole("button", { name: "View bill (2) · ₹540" });
  await expect(bar).toContainText("2 items");
  await expect(bar).toContainText("View bill ›");
  const tabs = page.getByRole("button", { name: "Delivery", exact: true });
  await expect(tabs).toHaveAttribute("aria-current", "page");
  const b = (await bar.boundingBox())!;
  const t = (await tabs.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(t.y);   // the bar ends above the tab bar
});

test("TC 20.2 View bill: the same two dishes and the same total", async ({ page, context }) => {
  await menuWithTwo(page, context);
  await addBoth(page);
  await page.getByRole("button", { name: "View bill (2) · ₹540" }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("1 × Butter Chicken", { exact: true })).toBeVisible();
  await expect(page.getByText("1 × Dal Makhani", { exact: true })).toBeVisible();
  await expect(page.getByText("₹540", { exact: true })).toBeVisible();
});

test("TC 20.3 Minus to 0 on one dish: its row goes back to Add, the bar count drops, the other dish stays", async ({ page, context }) => {
  await menuWithTwo(page, context);
  await addBoth(page);
  await page.getByRole("button", { name: "Less Butter Chicken" }).click();
  await expect(page.getByRole("button", { name: "View bill (1) · ₹220" })).toBeVisible();   // the bar follows the change first, so the counter is proven live
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Quantity of Dal Makhani" })).toHaveText("1");
});

test("TC 20.4 Close the app, reopen: the two items are still in the bar and in the bill", async ({ page, context }) => {
  await menuWithTwo(page, context);
  await addBoth(page);
  await expect(page.getByRole("button", { name: "View bill (2) · ₹540" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "View bill (2) · ₹540" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("1");
  await expect(page.getByRole("status", { name: "Quantity of Dal Makhani" })).toHaveText("1");
  await page.getByRole("button", { name: "View bill (2) · ₹540" }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("1 × Butter Chicken", { exact: true })).toBeVisible();
});

test("TC 20.5 20 of one dish: More stops at 20, and a clear cap in our words shows", async ({ page, context }) => {
  await menuWithTwo(page, context);
  const qty = page.getByRole("status", { name: "Quantity of Butter Chicken" });
  const more = page.getByRole("button", { name: "More Butter Chicken" });
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  for (let n = 2; n <= 20; n++) {
    await more.click();
    await expect(qty).toHaveText(String(n));   // each step waits for the counter, no sleeps
  }
  await expect(more).toBeDisabled();
  await expect(page.getByRole("button", { name: "View bill (20) · ₹6400" })).toBeVisible();   // 20 x Rs 320: the bar counts 20 too
  // Expected: a visible line that names the limit of 20 in our words. The app shows no such line today (#1207).
  test.fail(true, "#1207: at 20 the + is disabled with no words; the app shows no cap message");
  await expect(page.getByText(/\b20\b/).filter({ hasText: /at most|limit|maximum|up to|max/i })).toBeVisible();
});
