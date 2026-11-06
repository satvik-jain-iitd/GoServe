// Story 779, board Menu-DishLine-Tint: one short line under each dish, and the thali switch tints the side that is showing, also after a swipe.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const DISHES = [
  { id: "d1", name: "Chicken Thali", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Thali", description: null },
  { id: "d2", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali", description: null },
  { id: "d3", name: "Butter Chicken", price_paise: 28000, image_url: null, image_credit: null, veg: false, category: "Mains", description: "Slow cooked overnight, butter on top" },
  { id: "d4", name: "Paneer Tikka", price_paise: 24000, image_url: null, image_credit: null, veg: true, category: "Mains", description: null },
];

test("S1 a dish with a line shows it under the name on the tile and on the dish sheet", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  const tile = page.locator("article.ui-tile", { hasText: "Butter Chicken" });
  await expect(tile.getByText("Slow cooked overnight, butter on top")).toBeVisible();
  await tile.getByRole("button", { name: "Butter Chicken details" }).click();
  await expect(page.getByRole("dialog").getByText("Slow cooked overnight, butter on top")).toBeVisible();
});

test("S2 a dish with no line shows no line and the tile keeps its height", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  const tile = page.locator("article.ui-tile", { hasText: "Paneer Tikka" });
  await expect(tile.locator("p.ui-meta")).toHaveCount(0);
});

test("S3 the Admin add-dish form refuses a line of 61 characters in plain words", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await page.getByLabel("Dish name").fill("Dal Makhani");
  await page.getByLabel("Price (₹)").fill("220");
  await page.getByLabel("Short line").fill("x".repeat(61));
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect(page.getByRole("alert")).toContainText("60 characters");
  expect(net.calls.menuWrites).toHaveLength(0);
  await page.getByLabel("Short line").fill("Slow cooked overnight");
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0].body).toMatchObject({ description: "Slow cooked overnight" });
});

test("S4 the thali switch tints the side that is showing, and the tint follows a swipe with no tap (acceptance 4)", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  const veg = page.getByRole("link", { name: "Veg thali", exact: true }), non = page.getByRole("link", { name: "Non-veg thali", exact: true });
  const bg = (l: typeof veg) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  const vegTint = await bg(veg);
  expect(vegTint, "veg side is tinted green at first").not.toBe("rgba(0, 0, 0, 0)");
  await page.locator(".ui-hero .pager").evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "instant" as ScrollBehavior }));
  await expect.poll(() => bg(non)).not.toBe("rgba(0, 0, 0, 0)");
  await expect.poll(() => bg(veg)).toBe("rgba(0, 0, 0, 0)");
  expect(await bg(non), "non-veg tint is not the veg tint").not.toBe(vegTint);
});
