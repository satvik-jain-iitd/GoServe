// Story #930: the "No connection" banner is true. Online with a working server there is none; a dead phone network shows it; a server fault says GoServe is slow.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const OFFLINE_LINE = "No connection. Showing the menu you saw last.";
const SLOW_LINE = "GoServe is slow right now. Showing the menu you saw last.";

test("S1 online with a working server: no banner at all", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByText(OFFLINE_LINE)).toHaveCount(0);
  await expect(page.getByText(SLOW_LINE)).toHaveCount(0);
});

test("S2 one slow read while online keeps the saved menu with no banner, and the fresh menu lands", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the first load saves the copy
  let n = 0;
  await context.route("**/rest/v1/menu_items**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (++n === 1) return route.fulfill({ status: 500, headers: { ...CORS, "content-type": "application/json" }, body: "{}" });   // the first read after the reload fails
    return route.fallback();
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByText(OFFLINE_LINE)).toHaveCount(0);
  await expect(page.getByText(SLOW_LINE)).toHaveCount(0);
  await expect.poll(() => n, { timeout: 8000 }).toBeGreaterThanOrEqual(2);   // it read again
  await expect(page.getByText(SLOW_LINE)).toHaveCount(0);
});

test("S3 a server that keeps failing says GoServe is slow, never 'No connection'", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await context.route("**/rest/v1/menu_items**", (route) => route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 500, headers: { ...CORS, "content-type": "application/json" }, body: "{}" }));
  await page.reload();
  await expect(page.getByText(SLOW_LINE)).toBeVisible({ timeout: 12000 });
  await expect(page.getByText(OFFLINE_LINE)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S4 airplane mode: the phone says it is offline, so the line is 'No connection' at once", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(OFFLINE_LINE)).toBeVisible();
  await expect(page.getByText(SLOW_LINE)).toHaveCount(0);
});

test("S5 the banner keeps 12 px of air under the zigzag", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await context.route("**/rest/v1/menu_items**", (route) => route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 500, headers: { ...CORS, "content-type": "application/json" }, body: "{}" }));
  await page.reload();
  const banner = page.getByText(SLOW_LINE);
  await expect(banner).toBeVisible({ timeout: 12000 });
  expect(await banner.evaluate((el) => parseFloat(getComputedStyle(el).marginTop))).toBeGreaterThanOrEqual(12);
});
