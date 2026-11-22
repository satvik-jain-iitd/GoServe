// Story 1765 (owner, 22 Nov 2026): the dev deploy has no VITE_OFFERS, so the offers are off. The Bill must still show the quote's fee rows and add up to its total.
// This spec runs only in playwright.nooffers.config.ts (the dev deploy's switches); the main config skips it. The heading stays "To pay at door" and the Offers block and the code field stay hidden.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const quote = (over: { delivery?: number; gift?: number }) => {
  const delivery = over.delivery ?? 0, gift = over.gift ?? 0;
  return { ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000, fees: { delivery_paise: delivery, packaging_paise: 0, total_paise: delivery }, discount_paise: 0, coupon: null, tax_paise: 0, tax_mode: "inclusive",
    early_friend_paise: gift, to_pay_paise: 32000 + delivery - gift, saved_paise: gift, offers: [{ code: "FLAT50", title: "Rs 50 off", saves_paise: 5000 }] };
};
async function toBill(context: BrowserContext, page: Page, over: { delivery?: number; gift?: number }, size = { width: 390, height: 844 }) {
  await setup(context, page);
  await context.route("https://test.supabase.co/functions/v1/quote", (route) => route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote(over)) }));
  await page.setViewportSize(size);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
}
const slip = (page: Page) => page.getByRole("region", { name: "Items" });
const total = (page: Page) => page.getByTestId("bill-total");
const sum = async (page: Page) => {
  const rows = await slip(page).locator(".ui-slip-lines > div span:last-child").allTextContents();
  return rows.reduce((n, t) => n + (t === "Free" ? 0 : Number(t.replace("−", "-"))), 0);
};
const scrollH = (page: Page) => page.evaluate(() => Math.max(...Array.from(document.querySelectorAll<HTMLElement>(".ui-scroll")).map((e) => e.scrollHeight)));

test("B1 offers off, fee 2500: the Delivery row says 25 and the rows add up to the total (AC-1, AC-2)", async ({ page, context }) => {
  await toBill(context, page, { delivery: 2500 });
  await expect(slip(page).getByText("Delivery").locator("..")).toContainText("25");
  await expect(slip(page).getByText("Free")).toHaveCount(0);
  await expect(total(page)).toHaveText("₹345");
  expect(await sum(page)).toBe(345);
});

test("B2 offers off, fee 0: the Delivery row says Free as before (AC-3)", async ({ page, context }) => {
  await toBill(context, page, { delivery: 0 });
  await expect(slip(page).getByText("Delivery").locator("..")).toContainText("Free");
  await expect(total(page)).toHaveText("₹320");
  expect(await sum(page)).toBe(320);
});

test("B3 offers off: the early friend gift row shows and the rows still add up", async ({ page, context }) => {
  await toBill(context, page, { delivery: 2500, gift: 10000 });
  await expect(slip(page).getByText("Early friend gift")).toBeVisible();
  await expect(total(page)).toHaveText("₹245");
  expect(await sum(page)).toBe(245);
});

test("B4 offers off: no Offers block and no code field, and the heading stays To pay at door (AC-4)", async ({ page, context }) => {
  await toBill(context, page, { delivery: 2500 });
  await expect(total(page)).toHaveText("₹345");
  await expect(page.getByRole("region", { name: "Offers" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Apply / })).toHaveCount(0);
  await expect(page.getByLabel(/code/i)).toHaveCount(0);
  await expect(slip(page).getByText("To pay at door")).toBeVisible();
});

// AC-2 on a small phone: the fee changes a value, not a row, so there is no new scroll; the gift is one more row and nothing else moves. Three tests, one page each, in order.
test.describe.serial("B5 360x640 scroll", () => {
  const small = { width: 360, height: 640 };
  const seen: Record<string, number> = {};
  test("B5a fee 0", async ({ page, context }) => { await toBill(context, page, { delivery: 0 }, small); await expect(total(page)).toHaveText("₹320"); seen.free = await scrollH(page); });
  test("B5b fee 2500 adds no scroll", async ({ page, context }) => {
    await toBill(context, page, { delivery: 2500 }, small); await expect(total(page)).toHaveText("₹345");
    expect(Math.abs((await scrollH(page)) - seen.free)).toBeLessThanOrEqual(1);
  });
  test("B5c the gift adds one row, 40 px at most", async ({ page, context }) => {
    await toBill(context, page, { delivery: 2500, gift: 10000 }, small); await expect(total(page)).toHaveText("₹245");
    expect((await scrollH(page)) - seen.free).toBeLessThanOrEqual(40);
  });
});
