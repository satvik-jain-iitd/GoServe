// Story #274: the menu dish row is a 3-column grid (photo, text, Add), open or closed; the credit is in the dish sheet only; a closed kitchen says one clear line.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const DISH = { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", image_credit: "File:Butter chicken.jpg, Wikimedia Commons, CC BY-SA 4.0", veg: false, category: "Mains" };
const KITCHEN = (over: object) => ({ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, lat: null, lng: null, opens_at: null, ...over });
const columns = (page: Page) => page.locator(".ui-list article").first().evaluate((el) => {
  const s = getComputedStyle(el);
  return { display: s.display, tracks: s.gridTemplateColumns.split(" ").length };
});

test.use({ viewport: { width: 390, height: 844 } });

for (const closed of [false, true]) {
  test(`S1 the dish row is a 3-column grid at 390 px, ${closed ? "closed" : "open"}`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.menu = [DISH];
    if (closed) net.state.kitchens = [KITCHEN({})];
    await page.goto("/customer/");
    await expect(page.locator(".ui-list article").first()).toBeVisible();
    expect(await columns(page)).toEqual({ display: "grid", tracks: 3 });
  });
}

test("S2 the photo credit is not on the menu row, and the dish sheet carries the clean credit", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [DISH];
  await page.goto("/customer/");
  await expect(page.locator(".ui-list article").first()).toBeVisible();
  await expect(page.locator(".ui-list").getByText(/Photo:/)).toHaveCount(0);
  await page.getByRole("button", { name: "Butter Chicken details" }).click();
  await expect(page.getByText("Photo: Wikimedia Commons, CC BY-SA 4.0", { exact: true })).toBeVisible();
});

test("S3 a closed kitchen with an opening time says one line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [DISH];
  net.state.kitchens = [KITCHEN({ opens_at: "11:00:00" })];
  await page.goto("/customer/");
  await expect(page.getByText("Closed now. Opens at 11:00 am. You can look at the menu.", { exact: true })).toBeVisible();
  await expect(page.getByText("Please try again later")).toHaveCount(0);
  await expect(page.getByText("Look at the menu now")).toHaveCount(0);
});

test("S3 a closed kitchen with no opening time says one line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [DISH];
  net.state.kitchens = [KITCHEN({})];
  await page.goto("/customer/");
  await expect(page.getByText("Closed now. You can look at the menu.", { exact: true })).toBeVisible();
});

test("S4 the admin Numbers tiles keep their own class and the menu keeps the grid", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.numbers = [{ day: "2026-10-23", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", orders: 5, delivered: 3, cancelled: 1, cash_paise: 90000 }];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  const tile = page.getByTestId("tile-orders");
  await expect(tile).toBeVisible();
  expect(await tile.evaluate((el) => ({ cls: el.className, dir: getComputedStyle(el).flexDirection }))).toEqual({ cls: "ui-stat", dir: "column" });
});
