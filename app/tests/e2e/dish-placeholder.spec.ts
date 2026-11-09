// Story #937 (board P1-Placeholder, option A picked by the owner 8 Nov): a dish with no photo shows the plate with a fork and a spoon, never a blank box or two plain circles.
// One component for every place: the menu tile, the dish page, the thali card and the admin dish row.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const FORK = 'path[d^="M8 10v9"]';   // the fork's stroke in option A

test("S1 a menu tile for a dish with no photo shows the plate, fork and spoon", async ({ page, context }) => {
  await setup(context, page);   // the one dish, Butter Chicken, has image_url null
  await page.goto("/customer/");
  const tile = page.locator(".ui-tile .ui-ph").first();
  await expect(tile).toBeVisible();
  await expect(tile.locator(FORK)).toHaveCount(1);
  await expect(tile.locator("circle")).toHaveCount(2);   // the plate and its rim
  await expect(tile.locator("svg")).toHaveAttribute("aria-hidden", "true");
});

test("S2 the dish page for a dish with no photo shows the same placeholder, big", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Butter Chicken details" }).click();
  const big = page.locator(".ui-dish-photo.ui-ph");
  await expect(big).toBeVisible();
  await expect(big.locator(FORK)).toHaveCount(1);
  expect((await big.locator("svg").boundingBox())!.width).toBeGreaterThanOrEqual(64);
});

test("S3 a sold out dish keeps the placeholder, grey, with no words of its own", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [{ id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, available: false }];
  await page.goto("/customer/");
  const tile = page.locator(".ui-tile.sold .ui-ph").first();
  await expect(tile.locator(FORK)).toHaveCount(1);
  await expect(tile).toHaveText("");
});

test("S4 the admin dish row shows it too", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  const thumb = page.locator(".ui-dish-thumb.ui-ph").first();
  await expect(thumb.locator(FORK)).toHaveCount(1);
});

test("S5 the plate sits in the middle of its tile", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  const box = (await page.locator(".ui-tile .ui-ph").first().boundingBox())!;
  const svg = (await page.locator(".ui-tile .ui-ph svg").first().boundingBox())!;
  expect(Math.abs(svg.x + svg.width / 2 - (box.x + box.width / 2))).toBeLessThan(2);
  expect(Math.abs(svg.y + svg.height / 2 - (box.y + box.height / 2))).toBeLessThan(2);
});
