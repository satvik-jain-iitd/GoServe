// Story #972, board F1-Filter: the filter sheet has a checkbox per category (multi-select); the veg switch applies to the whole menu; no jump list.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const dish = (id: string, name: string, category: string, veg: boolean) => ({ id, name, price_paise: 10000, category, veg, available: true, image_url: null, image_credit: null });
const MENU = [dish("d1", "Dal Makhani", "Mains", true), dish("d2", "Butter Chicken", "Mains", false), dish("d3", "Tandoori Roti", "Breads", true), dish("d4", "Keema Naan", "Breads", false),
  dish("d5", "Jeera Rice", "Rice", true), dish("d6", "Gulab Jamun", "Sweets", true)];

const open = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Filter" }).click();
  return page.getByRole("dialog", { name: "Filter" });
};
const dishes = (page: Page) => page.locator("article.ui-tile, .ui-dish-row, article").filter({ has: page.getByRole("button", { name: /^Add / }) });

test("S1 the sheet lists each category as a checkbox with its count, in a Categories group, and has no jump list", async ({ page, context }) => {
  const sheet = await open(page, context);
  const group = sheet.getByRole("group", { name: "Categories" });
  for (const name of ["Mains", "Breads", "Rice", "Sweets"]) await expect(group.getByRole("checkbox", { name })).toBeVisible();
  await expect(group.getByRole("checkbox", { name: "Mains" })).not.toBeChecked();
  await expect(sheet.getByRole("navigation", { name: "Sections" })).toHaveCount(0);
  await expect(sheet.getByText("6 of 6 dishes")).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Clear all" })).toHaveCount(0);   // nothing ticked
});

test("S2 tick Breads: only breads show and the count says so; tick Rice too: both show", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("checkbox", { name: "Breads" }).check();
  await expect(sheet.getByText("2 of 6 dishes")).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Rice" }).check();
  await expect(sheet.getByText("3 of 6 dishes")).toBeVisible();
  await sheet.getByRole("button", { name: "Show 3 dishes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const n of ["Tandoori Roti", "Keema Naan", "Jeera Rice"]) await expect(page.getByRole("heading", { name: n })).toBeVisible();
  for (const n of ["Dal Makhani", "Butter Chicken", "Gulab Jamun"]) await expect(page.getByRole("heading", { name: n })).toHaveCount(0);
  await page.getByRole("button", { name: "Filter" }).click();   // Close keeps the ticks
  await expect(page.getByRole("dialog", { name: "Filter" }).getByRole("checkbox", { name: "Breads" })).toBeChecked();
});

test("S3 Clear all (shown only when something is ticked) brings the whole menu back", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("checkbox", { name: "Sweets" }).check();
  await expect(sheet.getByText("1 of 6 dishes")).toBeVisible();
  await sheet.getByRole("link", { name: "Clear all" }).click();
  await expect(sheet.getByText("6 of 6 dishes")).toBeVisible();
  await expect(sheet.getByRole("checkbox", { name: "Sweets" })).not.toBeChecked();
  await expect(sheet.getByRole("link", { name: "Clear all" })).toHaveCount(0);
});

test("S4 Veg only with Breads shows only the veg breads", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("switch", { name: /Veg only/ }).check();
  await sheet.getByRole("checkbox", { name: "Breads" }).check();
  await expect(sheet.getByText("1 of 6 dishes")).toBeVisible();
  await sheet.getByRole("button", { name: "Show 1 dish" }).click();
  await expect(page.getByRole("heading", { name: "Tandoori Roti" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keema Naan" })).toHaveCount(0);
});

test("S5 ticks that match nothing show the Nothing matches card with the way out", async ({ page, context }) => {
  const sheet = await open(page, context);
  await sheet.getByRole("switch", { name: /Veg only/ }).check();
  await sheet.getByRole("checkbox", { name: "Mains" }).check();
  await sheet.getByRole("checkbox", { name: "Mains" }).uncheck();
  await sheet.getByLabel("Search dishes").fill("zzz");
  await sheet.getByRole("button", { name: "Show 0 dishes" }).click();
  await expect(page.getByText("Nothing matches")).toBeVisible();
  await expect(page.getByText("Try another word or clear the filters.")).toBeVisible();
});
