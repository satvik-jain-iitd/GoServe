// Story #1611 (epic #1274, owner pick A): History shows one card per kitchen. The card is the saved-address card (ui-saved-card); the kitchen name is the
// Deliver to heading size and weight, in full ink, on its own line; one small line under it. Shared cases, run by Chromium (history-cards.spec.ts)
// and by WebKit (history-cards.webkit.spec.ts). Every number is measured in the browser, never read from the CSS text.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { order, phoneLoc, setup } from "./helpers";

type Ctx = Parameters<typeof setup>[0];
// The one small line under the kitchen name, inside the card's head.
const cardLine = (card: Locator) => card.locator(".ui-order-group span").first();
const uid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const K2 = { id: "k-2", name: "Saket Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
const LONG = "Ramesh Sharma Family Dhaba and Tiffin Co";   // 40 characters, one name, no spaces to break it
const K3 = { ...K2, id: "k-3", name: LONG };
const past = (n: number, kitchen: string, created: string) => ({
  ...order("delivered", created, created), id: uid(n), kitchen_id: kitchen, items: [{ menu_item_id: "d1", name: "Veg Thali", qty: 1, price_paise: 18000 }], total_paise: 18000,
});
const TWO = [past(1, "k-1", "2020-11-14T14:00:00Z"), past(2, "k-1", "2020-11-12T14:00:00Z"), past(3, "k-2", "2020-11-13T14:00:00Z")];

async function history(page: Page, context: Ctx, orders: object[], kitchens: object[] = [K2]) {
  const net = await setup(context, page, orders);
  net.state.menu = [{ id: "d1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null }];
  net.state.kitchens = [...(net.state.kitchens as object[]), ...kitchens];
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "History" })).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  return net;
}

// The saved-address and recent sections of Deliver to, the screen whose heading and section gap the card copies.
async function deliverTo(page: Page, context: Ctx) {
  const net = await setup(context, page, [], { pin: null });
  const recent = { id: "r1", name: "Road 1", address: "Flat 1, Road 1", pin_code: "110016", lat: 28.58, lng: 77.24, house: "Flat 1", landmark: null, used_at: "2026-11-11T10:00:00Z" };
  net.state.addresses = [{ id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" }];
  net.state.recents = [recent];
  await phoneLoc(page, { perm: "granted", pos: { latitude: 28.5683, longitude: 77.2436 } });
  await page.goto("/customer/");
  await page.getByTitle("Change the delivery address").click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  return net;
}

const box = (loc: import("@playwright/test").Locator) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });
const lum = (rgb: string) => {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => { const s = Number(v) / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

export function historyCards() {
  test("two kitchens: one card per kitchen, and each row sits inside the card of its own kitchen", async ({ page, context }) => {
    await history(page, context, TWO);
    const cards = page.locator(".ui-saved-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator(".ui-order-row")).toHaveCount(2);   // the kitchen that cooks now, newest first
    await expect(cards.nth(1).locator(".ui-order-row")).toHaveCount(1);
    await expect(cards.nth(0).locator(".ui-order-group b")).toHaveText("Hauz Khas Kitchen");
    await expect(cards.nth(1).locator(".ui-order-group b")).toHaveText("Saket Kitchen");
    for (let i = 0; i < 2; i++) {
      const card = await box(cards.nth(i));
      for (const row of await cards.nth(i).locator(".ui-order-row").all()) {
        const r = await box(row);
        expect(r.x >= card.x && r.right <= card.right && r.y >= card.y && r.bottom <= card.bottom).toBe(true);
      }
    }
  });

  test("the kitchen name has the Deliver to heading's size, weight and family, and 4.5:1 or more contrast on the card", async ({ page, context }) => {
    await history(page, context, TWO);
    const card = page.locator(".ui-saved-card").nth(0);
    const name = card.locator(".ui-order-group b");
    const head = await page.locator(".ui-head h1").evaluate((e) => { const s = getComputedStyle(e); return { size: s.fontSize, weight: s.fontWeight, family: s.fontFamily }; });   // the same rule the Deliver to title uses
    const got = await name.evaluate((e) => { const s = getComputedStyle(e); return { size: s.fontSize, weight: s.fontWeight, family: s.fontFamily, color: s.color }; });
    expect({ size: got.size, weight: got.weight, family: got.family }).toEqual(head);
    const bg = await card.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(contrast(got.color, bg)).toBeGreaterThanOrEqual(4.5);
    await expect(cardLine(card)).toHaveText("cooks for you now");
  });

  test("the gap between two cards is the gap between the Saved addresses and Recently searched cards", async ({ page, context }) => {
    await history(page, context, TWO);
    const cards = page.locator(".ui-saved-card");
    const a = await box(cards.nth(0)), b = await box(cards.nth(1));
    const historyGap = Math.round(b.y - a.bottom);
    await deliverTo(page, context);
    const saved = await box(page.getByRole("region", { name: "Saved addresses" }));
    const recent = await box(page.getByRole("region", { name: "Recently searched" }));
    expect(historyGap).toBe(Math.round(recent.y - saved.bottom));
    expect(historyGap).toBeGreaterThan(0);
  });

  test("one kitchen only: one card", async ({ page, context }) => {
    await history(page, context, [past(1, "k-1", "2020-11-14T14:00:00Z")]);
    await expect(page.locator(".ui-saved-card")).toHaveCount(1);
    await expect(page.locator(".ui-saved-card .ui-order-row")).toHaveCount(1);
  });

  test("a 40-character kitchen name wraps inside its card: nothing sits outside it", async ({ page, context }) => {
    expect(LONG.length).toBe(40);
    await history(page, context, [past(1, "k-3", "2020-11-14T14:00:00Z")], [K3]);
    const card = await box(page.locator(".ui-saved-card").first());
    const name = await box(page.locator(".ui-saved-card .ui-order-group b"));
    expect(name.right).toBeLessThanOrEqual(card.right);
    expect(name.x).toBeGreaterThanOrEqual(card.x);
    expect(name.h).toBeGreaterThan(30);   // two lines at 24 px: it wrapped
  });

  test("360 by 640: no sideways scroll on History with two kitchens", async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await history(page, context, TWO, [K2, K3]);
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });
}

