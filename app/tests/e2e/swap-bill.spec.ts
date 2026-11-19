// Story #619 layer c (board L3): a dish in the bill that went sold out. The Bill says why, offers the server's one alternative with the swap discount,
// and has two ways out: Swap it in, Take it out. Story 1706 (owner, 20 Nov 2026): the offer is a bottom sheet that needs an answer (no tap outside, no Escape, Back leaves the Bill and the sheet returns with it). No alternative: the item goes out and the menu opens with the dish stamped Sold out.
// POST /quote and POST /orders are answered by the test, as the real functions answer (layer b).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const PANEER = { id: "d1", name: "Paneer Butter Masala", price_paise: 26000, image_url: null, image_credit: null, veg: true, available: true };
const DAL = { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, available: true };
const ROTI = { id: "d3", name: "Tandoori Roti", price_paise: 2000, image_url: null, image_credit: null, veg: true, available: true };
const ALT = { menu_item_id: "d2", name: "Dal Makhani", price_paise: 22000, discount_paise: 2200 };
const quoteOf = (lines: object[], itemTotal: number, swapDiscount = 0) => ({
  ok: true, kitchen_id: "k-1", lines, item_total_paise: itemTotal, fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, discount_paise: swapDiscount,
  coupon: null, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: itemTotal - swapDiscount, saved_paise: swapDiscount, offers: [],
  ...(swapDiscount ? { swap_discount_paise: swapDiscount, swaps: [{ from: "d1", to: "d2", discount_paise: swapDiscount }] } : {}),
});
const line = (d: typeof PANEER, qty: number) => ({ menu_item_id: d.id, name: d.name, qty, unit_paise: d.price_paise, extras_paise: 0, line_paise: d.price_paise * qty, options: [] });
const placed = { ok: true, created: true, order: { id: "0f0f0f0f-1111-4222-8333-444444444444", kitchen_id: "k-1", status: "placed", total_paise: 24000, address: "Flat 4", items: [], bill: {}, created_at: new Date().toISOString() } };

async function start(context: BrowserContext, page: Page, alt: object | null) {
  const net = await setup(context, page);
  net.state.menu = [PANEER, DAL, ROTI];
  const seen = { quotes: [] as any[], orders: [] as any[] };
  await context.route("https://test.supabase.co/functions/v1/quote", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const b = JSON.parse(route.request().postData() ?? "{}");
    seen.quotes.push(b);
    const lines: { menu_item_id: string; qty: number; swap?: boolean }[] = b.lines;
    const dead = lines.find((l) => l.menu_item_id === "d1");
    const answer = (status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (dead && !dead.swap) return answer(422, { ok: false, error: "dish_sold_out", message: "Paneer Butter Masala is sold out.", alternative: alt });
    const out = lines.flatMap((l) => (l.menu_item_id === "d1" ? [line(DAL, l.qty)] : [line(l.menu_item_id === "d2" ? DAL : ROTI, l.qty)]));
    const total = out.reduce((n, l: any) => n + l.line_paise, 0);
    return answer(200, quoteOf(out, total, dead ? 2200 * dead.qty : 0));
  });
  await context.route("https://test.supabase.co/functions/v1/orders", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    seen.orders.push(JSON.parse(route.request().postData() ?? "{}"));
    return route.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(placed) });
  });
  return { net, seen };
}
async function toSoldOutBill(page: Page, net: any) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Paneer Butter Masala" }).click();
  await page.getByRole("button", { name: "Add Tandoori Roti" }).click();
  net.state.menu = [{ ...PANEER, available: false }, DAL, ROTI];
  net.push("UPDATE", { ...PANEER, available: false }, "menu_items");
  await expect(page.locator("article").filter({ hasText: "Paneer Butter Masala" }).getByText("Sold out", { exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /View bill/ }).click();
}

test("S1 the bill says why, offers the one alternative with the discount, and will not place until it is fixed", async ({ page, context }) => {
  const { net } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  const alert = page.getByRole("dialog", { name: "Paneer Butter Masala is sold out" });   // story 1706: the offer is a sheet, no longer a red box
  await expect(alert.getByRole("heading", { name: "Paneer Butter Masala is sold out" })).toBeVisible();
  await expect(alert.getByText("Try Dal Makhani instead")).toBeVisible();
  await expect(alert.getByText("10% off from us, sorry for the trouble")).toBeVisible();
  await expect(alert.getByText("₹198")).toBeVisible();
  await expect(alert.getByRole("button", { name: "Swap it in" })).toBeVisible();
  await expect(alert.getByRole("button", { name: "Take it out" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
});

test("S2 Swap it in: the new dish and the discount are on the bill, and the order carries the swap", async ({ page, context }) => {
  const { net, seen } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  await page.getByRole("button", { name: "Swap it in" }).click();
  const slip = page.getByRole("region", { name: "Items" });
  await expect(slip.getByText("1 × Dal Makhani")).toBeVisible();
  await expect(slip.getByText("Swap discount")).toBeVisible();
  await expect(slip.getByText("−22")).toBeVisible();
  await expect(page.getByTestId("bill-total")).toHaveText("₹218");   // 22000 + 2000 less 2200
  expect(seen.quotes.at(-1).lines.find((l: any) => l.menu_item_id === "d1")).toMatchObject({ swap: true, qty: 1 });
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(seen.orders[0].lines.find((l: any) => l.menu_item_id === "d1")).toMatchObject({ swap: true, qty: 1 });
  expect(seen.orders[0].expected_to_pay_paise).toBe(21800);
});

test("S3 Take it out: the dish leaves the bill and the rest is kept", async ({ page, context }) => {
  const { net } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  await page.getByRole("button", { name: "Take it out" }).click();
  const slip = page.getByRole("region", { name: "Items" });
  await expect(slip.getByText("1 × Tandoori Roti")).toBeVisible();
  await expect(slip.getByText("Paneer Butter Masala")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("S4 no alternative: the item goes out, the rest of the bill is kept, and the menu opens with the dish stamped Sold out", async ({ page, context }) => {
  const { net } = await start(context, page, null);
  await toSoldOutBill(page, net);
  await expect(page.locator("article").filter({ hasText: "Paneer Butter Masala" }).getByText("Sold out", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("1 item");   // the roti is kept
});

const rect = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom }; });
const lines = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Paneer Butter Masala is sold out" });

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S5 the offer is a bottom sheet: Take it out above, Swap it in last, both full width, one line each, no offer box in the page (${w}x${h})`, async ({ page, context }) => {
    const { net } = await start(context, page, ALT);
    await page.setViewportSize({ width: w, height: h });
    await toSoldOutBill(page, net);
    const sheet = sheetOf(page);
    await expect(sheet).toBeVisible();
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))); });
    await expect(page.getByRole("alert").filter({ hasText: "is sold out" })).toHaveCount(0);   // the red box inside the Bill is gone
    await expect(sheet.getByText("Try Dal Makhani instead")).toBeVisible();
    const take = sheet.getByRole("button", { name: "Take it out" }), swap = sheet.getByRole("button", { name: "Swap it in" });
    const [t, sw, s] = [await rect(take), await rect(swap), await rect(sheet)];
    const pad = await sheet.evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth), r: parseFloat(c.paddingRight) + parseFloat(c.borderRightWidth), b: parseFloat(c.paddingBottom) }; });
    console.log(`S5 ${w}x${h}`, JSON.stringify({ take: t, swap: sw, sheet: s, pad, gap: sw.y - (t.y + t.h) }));
    expect(t.y).toBeLessThan(sw.y);   // Take it out above, Swap it in last
    expect(Math.abs(t.x - sw.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(t.w - sw.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(t.x - (s.x + pad.l))).toBeLessThanOrEqual(1);   // full width of the sheet's content
    expect(Math.abs(t.x + t.w - (s.x + s.w - pad.r))).toBeLessThanOrEqual(1);
    expect(t.h).toBeGreaterThanOrEqual(44);
    expect(sw.h).toBeGreaterThanOrEqual(44);
    for (const l of [await lines(take), await lines(swap)]) expect(l.text).toBeLessThan(1.5 * l.line);   // one line each
    expect(pad.b).toBeGreaterThanOrEqual(24);
    expect(Math.abs(s.bottom - sw.bottom - pad.b)).toBeLessThanOrEqual(1);   // the bottom gap as on the other sheets
    expect(Math.abs(s.bottom - h)).toBeLessThanOrEqual(1);   // it opens from the bottom
  });
}

test("S6 the sheet needs an answer: a tap outside and Escape do nothing, focus is on the sheet, stays in it, and Enter swaps nothing", async ({ page, context }) => {
  const { net, seen } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  const sheet = sheetOf(page);
  await expect(sheet).toBeVisible();
  await expect(sheet).toBeFocused();   // focus is on the dialog itself, not on a button
  await page.keyboard.press("Enter");
  await expect(sheet).toBeVisible();
  expect(seen.quotes.filter((q: any) => q.lines.some((l: any) => l.swap))).toHaveLength(0);   // Enter swapped nothing
  await page.mouse.click(10, 10);   // a tap outside, on the grey cover
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true); }   // focus never leaves the sheet
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
});

test("S7 Back leaves the Bill for the menu and adds no step for the sheet; the Bill opened again shows the sheet again", async ({ page, context }) => {
  const { net } = await start(context, page, ALT);
  await toSoldOutBill(page, net);
  await expect(sheetOf(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();   // the menu
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(sheetOf(page)).toBeVisible();   // the dish is still sold out
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
});
