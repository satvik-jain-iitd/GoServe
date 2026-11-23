// Story 1766 layer B2 (epic 1753; owner, 23 Nov 2026, frame s1766f, "Haan theek h"): when the Bill cannot get its price (no internet, or the server gives none) it says so.
// The total slot says "No price yet", one line in full ink sits above the bottom button, the button says "Try again" and asks again, Place order is never shown without a price,
// nothing moves (rule 23), and the Bill heals by itself when the price comes. Runs in the build with offers on and in the one with offers off (playwright.nooffers.config.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const NO_NET = "No internet. Check your internet and try again.";
const NO_PRICE = "We could not get your price. Try again in a minute.";
type Mode = "server" | "offline" | "ok";
const quote = (qty: number) => ({
  ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000 * qty, fees: { delivery_paise: 2500, packaging_paise: 0, total_paise: 2500 }, discount_paise: 0, coupon: null, tax_paise: 0,
  tax_mode: "inclusive", early_friend_paise: 0, to_pay_paise: 32000 * qty + 2500, saved_paise: 0, offers: [],
});

async function open(context: BrowserContext, page: Page, mode: Mode, size = { width: 390, height: 844 }) {
  const ctl = { mode, asked: 0 };
  const net = await setup(context, page, [], { quote: false });
  await context.route("https://test.supabase.co/rest/v1/rpc/delivery_fee_at_v1**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ amount_paise: 2500, as_of: "2026-11-23T10:00:00.000Z", now: "2026-11-23T10:00:00.000Z" }) });
  });
  await context.route("https://test.supabase.co/functions/v1/quote", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    ctl.asked += 1;
    if (ctl.mode === "offline") return route.abort("internetdisconnected");
    if (ctl.mode === "server") return route.fulfill({ status: 502, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "quote_unavailable" }) });
    const qty = (route.request().postDataJSON().lines ?? []).reduce((n: number, l: { qty: number }) => n + l.qty, 0);
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote(qty)) });
  });
  await page.setViewportSize(size);
  await page.goto("/customer/");
  return { net, ctl };
}
const toBill = async (page: Page) => {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
};
const total = (page: Page) => page.getByTestId("bill-total");
const foot = (page: Page) => page.locator(".bill-foot");
const line = (page: Page) => page.locator(".ui-bar-note");   // the one line above the button: a mark, then the words

test("B2-1 a server that gives no price: No price yet, the line, Try again, no Place order, no Free (AC-1, AC-2, AC-3)", async ({ page, context }) => {
  const { net } = await open(context, page, "server");
  await toBill(page);
  await expect(total(page)).toHaveText("No price yet");
  await expect(line(page)).toHaveText(`!${NO_PRICE}`);
  await expect(foot(page).getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);
  await expect(page.locator('[aria-label="Items"]')).not.toContainText("Free");
  expect(net.calls.place.length).toBe(0);
});

test("B2-2 no internet says so in its own words (AC-2)", async ({ page, context }) => {
  await open(context, page, "offline");
  await toBill(page);
  await expect(total(page)).toHaveText("No price yet");
  await expect(line(page)).toHaveText(`!${NO_NET}`);
});

test("B2-3 Try again asks the price again, and the Bill heals when it comes (AC-3, AC-5)", async ({ page, context }) => {
  const { ctl } = await open(context, page, "server");
  await toBill(page);
  await expect(total(page)).toHaveText("No price yet");
  const before = ctl.asked;
  ctl.mode = "ok";
  await foot(page).getByRole("button", { name: "Try again" }).click();
  await expect(total(page)).toHaveText("₹345");
  expect(ctl.asked).toBeGreaterThan(before);
  await expect(line(page)).toHaveCount(0);
  await expect(foot(page).getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("B2-4 a later cart change asks again by itself and heals the Bill (AC-5)", async ({ page, context }) => {
  const { ctl } = await open(context, page, "server");
  await toBill(page);
  await expect(total(page)).toHaveText("No price yet");
  ctl.mode = "ok";
  await page.getByRole("button", { name: "+ Add more" }).click();
  await page.getByRole("button", { name: "More Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(total(page)).toHaveText("₹665");
});

for (const size of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`B2-5 nothing moves between the failed and the loaded Bill, at ${size.width}x${size.height} (AC-4, rule 23)`, async ({ page, context }) => {
    const { ctl } = await open(context, page, "server", size);
    await toBill(page);
    const boxes = () => page.evaluate(() => {
      const r = (el: Element | null) => { const b = (el as HTMLElement | null)?.getBoundingClientRect(); return b ? { top: Math.round(b.top), height: Math.round(b.height), left: Math.round(b.left) } : null; };
      return { delivery: r(Array.from(document.querySelectorAll('[aria-label="Items"] .ui-slip-lines > div')).find((d) => d.textContent?.startsWith("Delivery")) ?? null),
        total: r(document.querySelector(".ui-slip-total")), label: r(document.querySelector(".ui-slip-total b")), more: r(document.querySelector(".ui-add-more")), foot: r(document.querySelector(".bill-foot button")) };
    });
    await expect(total(page)).toHaveText("No price yet");
    const failed = await boxes();
    ctl.mode = "ok";
    await foot(page).getByRole("button", { name: "Try again" }).click();
    await expect(total(page)).toHaveText("₹345");
    const done = await boxes();
    for (const k of Object.keys(failed) as (keyof typeof failed)[]) {
      expect(failed[k], k).not.toBeNull();
      expect(Math.abs(failed[k]!.top - done[k]!.top), `${k} top`).toBeLessThanOrEqual(1);
      expect(Math.abs(failed[k]!.height - done[k]!.height), `${k} height`).toBeLessThanOrEqual(1);
    }
  });
}

test("B2-6 the line is in full ink with a mark, above the button, and sits inside the screen (design review)", async ({ page, context }) => {
  await open(context, page, "server");
  await toBill(page);
  const note = line(page);
  await expect(note).toBeVisible();
  const [lb, bb] = await Promise.all([note.boundingBox(), foot(page).getByRole("button", { name: "Try again" }).boundingBox()]);
  expect(lb!.y + lb!.height).toBeLessThanOrEqual(bb!.y + 1);   // above the button
  expect(lb!.x).toBeGreaterThanOrEqual(0);
  expect(await page.locator(".ui-bar-note").evaluate((el) => getComputedStyle(el).color)).toBe(await page.locator(".ui-slip-total b").evaluate((el) => getComputedStyle(el).color));   // the ink of the Bill's own text
  await expect(page.locator(".ui-bar-note [aria-hidden='true']")).toHaveCount(1);   // the mark
});

// Reviewer, 23 Nov 2026 (frame s1766f): "No price yet" is small, mono, muted, in the same slot; the line has the full-width 1 px top line (owner rule 34).
const token = (page: Page, prop: string, css: "color" | "borderTopColor") => page.evaluate(([p, c]) => { const d = document.createElement("div"); d.style.setProperty(c === "color" ? "color" : "border-top-color", `var(${p})`); d.style.borderTopStyle = "solid"; document.body.append(d); const v = getComputedStyle(d)[c as "color"]; d.remove(); return v; }, [prop, css] as const);

test("B2-7 No price yet is 14 px, mono and muted, in the same slot (frame)", async ({ page, context }) => {
  await open(context, page, "server");
  await toBill(page);
  await expect(total(page)).toHaveText("No price yet");
  const st = await total(page).evaluate((el) => { const c = getComputedStyle(el); return { size: c.fontSize, color: c.color, family: c.fontFamily }; });
  expect(st.size).toBe("14px");
  expect(st.color).toBe(await token(page, "--gs-text-muted", "color"));
  expect(st.family.toLowerCase()).toContain("mono");
});

test("B2-8 the line has the 1 px sage top line across the full width (rule 34)", async ({ page, context }) => {
  await open(context, page, "server", { width: 390, height: 844 });
  await toBill(page);
  const note = line(page);
  await expect(note).toBeVisible();
  const st = await note.evaluate((el) => { const c = getComputedStyle(el); const b = el.getBoundingClientRect(); return { w: c.borderTopWidth, style: c.borderTopStyle, color: c.borderTopColor, left: Math.round(b.left), width: Math.round(b.width) }; });
  expect(st.w).toBe("1px");
  expect(st.style).toBe("solid");
  expect(st.color).toBe(await token(page, "--gs-sage", "borderTopColor"));
  expect(st.left).toBe(0);
  expect(st.width).toBe(390);
});
