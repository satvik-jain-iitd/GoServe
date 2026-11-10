// Regression, screen 22: S-EmptyBill Empty bill. Cases: .claude/handoff/qa/screens/22-S-EmptyBill.md (epic #1196). TC 22.1 and 22.2 reach the empty bill with the draft the case names; TC 22.3 reaches the bill with the shared step STEPS["bill"], then the dish goes sold out on the bill.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { setup } from "../helpers";

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
const BUTTER_CHICKEN = { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Mains", available: true };
const SOLD_OUT_DISH = { ...BUTTER_CHICKEN, available: false };

const emptyBill = (page: Page) => page.getByRole("region", { name: "Empty bill" });

// The case's draft: the bill step with an empty cart. The app reads it on the next load.
async function openEmptyBill(context: BrowserContext, page: Page) {
  await setup(context, page);
  await page.goto(PATH);
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the menu loads first
  await page.evaluate(() => localStorage.setItem("gs-draft", JSON.stringify({ step: "bill", cart: {}, address: "", name: "", phone: "" })));
  await page.reload();
  await expect(emptyBill(page)).toBeVisible();
}

test("TC 22.1 Look: Nothing on it yet, Add a dish from the menu, See the menu, To pay at door Rs 0", async ({ page, context }) => {
  await openEmptyBill(context, page);
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();   // proves the bill screen shows, not the menu
  await expect(page.getByRole("heading", { name: "Nothing on it yet" })).toBeVisible();
  await expect(emptyBill(page).getByText("Add a dish from the menu.", { exact: true })).toBeVisible();
  await expect(emptyBill(page).getByRole("button", { name: "See the menu" })).toBeVisible();
  await expect(emptyBill(page).getByText("To pay at door", { exact: true })).toBeVisible();
  await expect(emptyBill(page).getByText("₹0", { exact: true })).toBeVisible();   // the case says Rs 0; the app prints the rupee sign
});

test("TC 22.2 Tap See the menu: the menu opens", async ({ page, context }) => {
  await openEmptyBill(context, page);
  await expect(page.getByRole("heading", { name: "Nothing on it yet" })).toBeVisible();   // proves the empty bill shows before the tap
  await emptyBill(page).getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nothing on it yet" })).toHaveCount(0);
});

test("TC 22.3 Last dish sold out and removed on the bill: this empty bill stays, not a blank bill", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);   // Butter Chicken in the bill
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  // The one dish goes sold out while the bill is open. The bill offers the one alternative and the way out, Take it out.
  await context.route(isPath("/functions/v1/quote"), async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 422, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "dish_sold_out", message: "Butter Chicken is sold out.", alternative: { menu_item_id: "d2", name: "Dal Makhani", price_paise: 22000, discount_paise: 2200 } }) });
  });
  await context.route(isPath("/rest/v1/menu_items"), (r) => answer(r, [SOLD_OUT_DISH]));
  await page.reload();
  const alert = page.getByRole("alert").filter({ hasText: "is sold out." });
  await expect(alert.getByText("Butter Chicken is sold out.")).toBeVisible();   // proves the sold-out bill shows before the removal
  await alert.getByRole("button", { name: "Take it out" }).click();
  await expect(alert).toHaveCount(0);
  await expect(emptyBill(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing on it yet" })).toBeVisible();   // this screen, not a blank bill
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toHaveCount(0);   // the menu did not open on its own
});
