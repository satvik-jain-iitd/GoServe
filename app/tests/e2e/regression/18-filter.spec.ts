// Regression, screen 18: F1 Filter sheet. Cases: .claude/handoff/qa/screens/18-F1.md (epic #1196, story #1197). Reached with the shared step STEPS["menu"]; the menu's dishes are then swapped for a three-group fixture (the step's own menu has one dish, so the filter has nothing to filter).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// Starters 2, Mains 2, Desserts 1 (5 dishes). Veg only leaves 3: Paneer Tikka, Dal Makhani, Gulab Jamun.
const DISHES = [
  { id: "s1", name: "Paneer Tikka", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Starters", available: true, description: null },
  { id: "s2", name: "Chicken Tikka", price_paise: 22000, image_url: null, image_credit: null, veg: false, category: "Starters", available: true, description: null },
  { id: "m1", name: "Dal Makhani", price_paise: 19000, image_url: null, image_credit: null, veg: true, category: "Mains", available: true, description: null },
  { id: "m2", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Mains", available: true, description: null },
  { id: "d1", name: "Gulab Jamun", price_paise: 9000, image_url: null, image_credit: null, veg: true, category: "Desserts", available: true, description: null },
];

// Reach the menu with the shared step, then answer the menu read with the fixture and load the menu again.
async function reach(context: BrowserContext, page: Page) {
  await STEPS["menu"](context, page, PATH);
  await context.route(
    (url) => url.hostname === "test.supabase.co" && url.pathname === "/rest/v1/menu_items",
    (route) => {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(DISHES) });
    },
  );
  await page.reload();
  await expect(dish(page, "Paneer Tikka")).toBeVisible();
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Filter" });
const dish = (page: Page, name: string) => page.getByRole("button", { name: `${name} details`, exact: true });
const group = (page: Page, title: string) => sheet(page).getByRole("checkbox", { name: new RegExp(`^${title}`) });

async function openFilter(page: Page) {
  await page.getByRole("button", { name: "Filter the menu" }).click();
  await expect(sheet(page)).toBeVisible();
}

test("TC 18.1 Filter sheet: the title, N of M dishes, Veg only, a row per group with its count, Clear all, a filled Show button", async ({ page, context }) => {
  await reach(context, page);
  await openFilter(page);
  const s = sheet(page);
  await expect(s.getByRole("heading", { name: "Filter", exact: true })).toBeVisible();
  await expect(s.getByText("5 of 5 dishes")).toBeVisible();
  await expect(s.getByRole("switch", { name: /^Veg only/ })).not.toBeChecked();
  const rows = s.getByRole("group", { name: "Categories" }).locator("label.ui-cat-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveText(/Starters\s*2/);
  await expect(rows.nth(1)).toHaveText(/Mains\s*2/);
  await expect(rows.nth(2)).toHaveText(/Desserts\s*1/);
  // The app shows Clear all only once a group is ticked (the board picture opens with two ticked), so tick one to see it.
  await group(page, "Mains").check();
  await expect(s.getByRole("link", { name: "Clear all" })).toBeVisible();
  const show = s.getByRole("button", { name: "Show 2 dishes" });
  await expect(show).toBeVisible();
  expect(await show.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");   // filled, not an outline
});

test("TC 18.2 untick two groups, Show: the menu shows only the ticked groups", async ({ page, context }) => {
  // The app starts with no group ticked (none ticked means the whole menu), so the case's "untick two" is run as "tick two".
  await reach(context, page);
  await openFilter(page);
  await group(page, "Mains").check();
  await group(page, "Desserts").check();
  await sheet(page).getByRole("button", { name: "Show 3 dishes" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(dish(page, "Dal Makhani")).toBeVisible();
  await expect(dish(page, "Gulab Jamun")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Starters", exact: true })).toHaveCount(0);
  await expect(dish(page, "Paneer Tikka")).toHaveCount(0);
  await expect(dish(page, "Chicken Tikka")).toHaveCount(0);
});

test("TC 18.3 Veg only on: the count and the list change to veg only", async ({ page, context }) => {
  await reach(context, page);
  await openFilter(page);
  await sheet(page).getByRole("switch", { name: /^Veg only/ }).check();
  await expect(sheet(page).getByText("3 of 5 dishes")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Show 3 dishes" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(dish(page, "Paneer Tikka")).toBeVisible();
  await expect(dish(page, "Dal Makhani")).toBeVisible();
  await expect(dish(page, "Gulab Jamun")).toBeVisible();
  await expect(dish(page, "Chicken Tikka")).toHaveCount(0);
  await expect(dish(page, "Butter Chicken")).toHaveCount(0);
});

test("TC 18.4 untick all: the Show button goes grey with a reason line (#1170)", async ({ page, context }) => {
  test.fail(true, "#1204: with no group ticked the whole menu still shows and Show stays filled, no reason line (#1171 not in the app yet)");
  await reach(context, page);
  await openFilter(page);
  await group(page, "Mains").check();
  await group(page, "Mains").uncheck();
  await expect(sheet(page).getByText("5 of 5 dishes")).toBeVisible();   // the sheet is live, so the next line can fail
  await expect(sheet(page).getByRole("button", { name: /^Show / })).toBeDisabled();   // grey: cannot be pressed
});

test("TC 18.5 Clear all: every group is ticked again", async ({ page, context }) => {
  test.fail(true, "#1205: Clear all leaves no group ticked (none ticked means the whole menu), the case expects every group ticked");
  await reach(context, page);
  await openFilter(page);
  await group(page, "Mains").check();
  await expect(sheet(page).getByRole("link", { name: "Clear all" })).toBeVisible();   // the link is live, so the next line can fail
  await sheet(page).getByRole("link", { name: "Clear all" }).click();
  await expect(group(page, "Starters")).toBeChecked();
  await expect(group(page, "Mains")).toBeChecked();
  await expect(group(page, "Desserts")).toBeChecked();
});

test("TC 18.6 close the sheet without Show: nothing changes", async ({ page, context }) => {
  test.fail(true, "#1206: a tick applies at once, so closing by the dark area without Show keeps the filter and Starters stay hidden");
  await reach(context, page);
  await expect(dish(page, "Chicken Tikka")).toBeVisible();   // every dish shows before the sheet opens
  await openFilter(page);
  await group(page, "Mains").check();
  await expect(sheet(page).getByText("2 of 5 dishes")).toBeVisible();
  await page.locator(".ui-sheet-back").click({ position: { x: 20, y: 20 } });   // the dark area above the sheet: close without Show
  await expect(sheet(page)).toBeHidden();
  await expect(dish(page, "Paneer Tikka")).toBeVisible();
  await expect(dish(page, "Chicken Tikka")).toBeVisible();
  await expect(dish(page, "Dal Makhani")).toBeVisible();
  await expect(dish(page, "Gulab Jamun")).toBeVisible();
});
