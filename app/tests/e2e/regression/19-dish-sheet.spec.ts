// Regression, screen 19: Dish sheet. Cases: .claude/handoff/qa/screens/19-Dish.md (epic #1196, story #1197). Reached with the shared step STEPS["menu"], then a tap on "Butter Chicken details".
// TC 19.3 (kitchen closed) is the one exception: no shared step closes the kitchen, so it uses setup() and kitchens[0].open = false, as 17-kitchen-closed does.
import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { setup } from "../helpers";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// One dish with every field the sheet shows (the shared fixture has no veg mark, description or category).
const DISH = { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Mains", available: true, description: "Slow cooked in a tomato and butter gravy." };

// Reach the menu with the shared step, then answer the menu read with the fixture and load the menu again.
async function reach(context: BrowserContext, page: Page) {
  await STEPS["menu"](context, page, PATH);
  await context.route(
    (url) => url.hostname === "test.supabase.co" && url.pathname === "/rest/v1/menu_items",
    (route) => {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify([DISH]) });
    },
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Butter Chicken details", exact: true }).first()).toBeVisible();
}

const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Butter Chicken" });
async function openSheet(page: Page) {
  await page.getByRole("button", { name: "Butter Chicken details", exact: true }).first().click();
  await expect(sheetOf(page)).toBeVisible();
  return sheetOf(page);
}
const box = async (loc: Locator) => (await loc.boundingBox())!;
const opacity = (loc: Locator) => loc.evaluate((e) => getComputedStyle(e).opacity);

test("TC 19.1 look: photo or placeholder, name, price, veg mark, description, How many stepper 44 px wide, Close above, Add to bill last", async ({ page, context }) => {
  await reach(context, page);
  const sheet = await openSheet(page);
  await expect(sheet.locator(".ui-dish-photo")).toBeVisible();   // a photo or the placeholder (image_url is null here, so the placeholder)
  await expect(sheet.getByRole("heading", { name: /Butter Chicken/ })).toBeVisible();
  await expect(sheet.getByText("₹320", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("img", { name: "Non-veg", exact: true })).toBeVisible();
  await expect(sheet.getByText("Non-veg · Mains", { exact: true })).toBeVisible();
  await expect(sheet.getByText(DISH.description, { exact: true })).toBeVisible();
  await expect(sheet.getByText("How many", { exact: true })).toBeVisible();
  for (const name of ["Less Butter Chicken", "More Butter Chicken"]) {
    expect(Math.abs((await box(sheet.getByRole("button", { name }))).width - 44)).toBeLessThanOrEqual(1);
  }
  const close = sheet.getByRole("button", { name: "Close", exact: true });
  const add = sheet.locator(".ui-dish-act button").last();
  await expect(sheet.locator(".ui-dish-act button").first()).toHaveText("Close");
  await expect(add).toHaveText("Add to bill · ₹320");   // last, at the bottom, and the price is on it
  expect((await box(add)).y).toBeGreaterThan((await box(close)).y + (await box(close)).height - 1);   // under Close, not beside it
});

test("TC 19.2 happy: stepper to 3, Add to bill, the sheet closes and the bar shows 3 items", async ({ page, context }) => {
  await reach(context, page);
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await expect(sheet.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("3");
  await expect(sheet.getByRole("button", { name: "Add to bill · ₹960", exact: true })).toBeVisible();   // the price follows the stepper
  await sheet.getByRole("button", { name: "Add to bill · ₹960", exact: true }).click();
  await expect(sheet).toBeHidden();
  const bar = page.getByRole("button", { name: "View bill (3) · ₹960", exact: true });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("3 items · ₹960");
});

test("TC 19.3 sad: kitchen closed, the sheet has no Add to bill at all, and it comes back when the kitchen opens", async ({ page, context }) => {
  const net = await setup(context, page);
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  await page.goto(PATH);
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible();
  const sheet = await openSheet(page);
  await expect(sheet.getByRole("button", { name: "Close", exact: true })).toBeVisible();   // the sheet is up
  await expect(sheet.getByText("How many", { exact: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /Add to bill/ })).toHaveCount(0);
  // The absence is live: open the kitchen and the same sheet gets its stepper and Add to bill back.
  (net.state.kitchens[0] as { open?: boolean }).open = true;
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(sheet.getByRole("button", { name: "Add to bill · ₹320", exact: true })).toBeVisible({ timeout: 5000 });
  await expect(sheet.getByText("How many", { exact: true })).toBeVisible();
});

test("TC 19.4 edge: stepper below 1, Less is grey (40 percent) and disabled at 1", async ({ page, context }) => {
  await reach(context, page);
  const sheet = await openSheet(page);
  const less = sheet.getByRole("button", { name: "Less Butter Chicken" });
  await expect(sheet.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("1");
  await expect(less).toBeDisabled();
  await expect.poll(() => opacity(less)).toBe("0.4");
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();   // live: one step up frees Less
  await expect(sheet.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("2");
  await expect(less).toBeEnabled();
  await expect.poll(() => opacity(less)).toBe("1");
});

test("TC 19.5 edge: Close leaves the bill unchanged, even after the stepper moved", async ({ page, context }) => {
  await reach(context, page);
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  const bar = page.getByRole("button", { name: "View bill (1) · ₹320", exact: true });
  await expect(bar).toBeVisible();
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await expect(sheet.getByRole("button", { name: "Add to bill · ₹960", exact: true })).toBeVisible();   // the stepper really moved (3)
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(bar).toBeVisible();   // still 1 item, still Rs 320
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(1);
  await expect(page.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("1");
});

// TC 19.6 (board: Close above Add to bill) is parked by the case file: n/a, not automated.
