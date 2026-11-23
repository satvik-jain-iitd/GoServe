// Story 1771 (owner, 22 Nov 2026, option A): the app asks POST /quote while the customer is still on the menu, so the Bill opens with the fee and the server's total
// already in its first drawn frame ("Free" is never drawn first when the fee is above 0). Runs in the build with offers on (playwright.config.ts) and with offers off
// (playwright.nooffers.config.ts, the dev deploy's switches). The menu screen is untouched: the Screens gate compares its picture.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const FEE = 2500;
type Hooks = { delayMs?: (qty: number) => number; soldOut?: boolean };
const qtyOf = (body: { lines?: { qty: number }[] }) => (body.lines ?? []).reduce((n, l) => n + l.qty, 0);
const quote = (qty: number) => ({
  ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000 * qty, fees: { delivery_paise: FEE, packaging_paise: 0, total_paise: FEE }, discount_paise: 0, coupon: null, tax_paise: 0,
  tax_mode: "inclusive", early_friend_paise: 0, to_pay_paise: 32000 * qty + FEE, saved_paise: 0, offers: [],
});

// The mock answers by the cart in the request, counts every call, and (init script) records the text of the Bill's Items region at its first draw and every total text after.
async function open(context: BrowserContext, page: Page, hooks: Hooks = {}) {
  const calls: number[] = [];
  await setup(context, page);
  await context.addInitScript(() => {
    const w = window as unknown as { __first?: string; __totals: string[] };
    w.__totals = [];
    new MutationObserver(() => {
      const t = document.querySelector('[data-testid="bill-total"]');
      if (!t) return;
      if (w.__first === undefined) w.__first = (document.querySelector('[aria-label="Items"]') as HTMLElement | null)?.innerText ?? "";
      const v = (t as HTMLElement).innerText;
      if (w.__totals[w.__totals.length - 1] !== v) w.__totals.push(v);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await context.route("https://test.supabase.co/functions/v1/quote", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const qty = qtyOf(route.request().postDataJSON());
    calls.push(qty);
    if (hooks.soldOut) return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "dish_sold_out", message: "Butter Chicken is sold out.", alternative: { menu_item_id: "x", name: "Dal", price_paise: 20000, discount_paise: 0 } }) });
    const wait = hooks.delayMs?.(qty) ?? 0;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote(qty)) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/customer/");
  return calls;
}
const add = (page: Page) => page.getByRole("button", { name: "Add Butter Chicken" }).click();
const more = (page: Page) => page.getByRole("button", { name: "More Butter Chicken" });
const viewBill = (page: Page) => page.getByRole("button", { name: /View bill/ }).click();
const settle = (page: Page) => page.waitForTimeout(700);   // longer than the 300 ms wait

test("Q1 the first drawn frame of the Bill has the fee and the server's total, not Free (AC-1)", async ({ page, context }) => {
  const calls = await open(context, page);
  await add(page);
  await settle(page);
  expect(calls).toEqual([1]);   // asked on the menu, before the Bill
  await viewBill(page);
  await expect(page.getByTestId("bill-total")).toHaveText("₹345");
  const first = await page.evaluate(() => (window as unknown as { __first?: string }).__first ?? "");
  expect(first).toContain("25");
  expect(first).not.toContain("Free");
  expect(calls).toEqual([1]);   // opening the Bill on the same cart asks nothing more
});

test("Q2 Add then View bill inside the wait sends exactly one call (AC-2)", async ({ page, context }) => {
  const calls = await open(context, page);
  await add(page);
  await viewBill(page);
  await expect(page.getByTestId("bill-total")).toHaveText("₹345");
  await settle(page);
  expect(calls).toEqual([1]);
});

test("Q3 fast taps send one call, with the last cart (AC-2)", async ({ page, context }) => {
  const calls = await open(context, page);
  await add(page);
  await more(page).click();
  await more(page).click();
  await settle(page);
  expect(calls).toEqual([3]);   // one call, for the last cart
});

test("Q4 a cart change after the answer never shows the old total on the Bill (AC-3)", async ({ page, context }) => {
  const calls = await open(context, page, { delayMs: (q) => (q === 2 ? 1200 : 0) });
  await add(page);
  await settle(page);
  await more(page).click();
  await viewBill(page);   // the answer for two is still 1.2 s away
  await expect(page.getByTestId("bill-total")).toHaveText("₹665", { timeout: 6000 });
  const seen = await page.evaluate(() => (window as unknown as { __totals: string[] }).__totals);
  expect(seen).not.toContain("₹345");   // the answer for one dish is never drawn for two
  expect(calls[calls.length - 1]).toBe(2);
});

test("Q5 nothing is asked while the cart is empty (AC-5)", async ({ page, context }) => {
  const calls = await open(context, page);
  await settle(page);
  expect(calls).toEqual([]);
});

test("Q6 a sold-out answer on the menu opens no swap box on the menu (AC-4)", async ({ page, context }) => {
  const calls = await open(context, page, { soldOut: true });
  await add(page);
  await settle(page);
  expect(calls.length).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/is sold out/)).toHaveCount(0);
});
