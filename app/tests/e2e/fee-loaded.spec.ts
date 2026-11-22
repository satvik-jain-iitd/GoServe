// Story 1775 (epic 1753; owner, 22 Nov 2026): the app reads the delivery fee when it starts and keeps it for this session; the Bill shows it at once, and every quote and order sends
// fee_as_of. While the quote is late, quiet grey bars stand where the total (and the amount on the bottom button) will come: never a wrong sum, never "Free" (frame s1766, owner: "Theek h chalega").
// Runs in the build with offers on (playwright.config.ts) and with offers off (playwright.nooffers.config.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const FEE = 2500;
const quote = (qty: number) => ({
  ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000 * qty, fees: { delivery_paise: FEE, packaging_paise: 0, total_paise: FEE }, discount_paise: 0, coupon: null, tax_paise: 0,
  tax_mode: "inclusive", early_friend_paise: 0, to_pay_paise: 32000 * qty + FEE, saved_paise: 0, offers: [],
});
type Opt = { rpcFail?: boolean; rpcDelay?: number; quoteDelay?: number; quoteFail?: boolean };

async function open(context: BrowserContext, page: Page, o: Opt = {}, size = { width: 390, height: 844 }) {
  const net = await setup(context, page);
  const rpc: { body: unknown; asOf: string }[] = [], quotes: Record<string, unknown>[] = [];
  await context.addInitScript(() => {   // the first draw of the Bill: the slip rows, the total and the bottom button, as text
    const w = window as unknown as { __first?: { rows: string; total: string; btn: string; label: string } };
    new MutationObserver(() => {
      const t = document.querySelector('[data-testid="bill-total"]') as HTMLElement | null;
      if (!t || w.__first) return;
      w.__first = { rows: (document.querySelector('[aria-label="Items"]') as HTMLElement | null)?.innerText ?? "", total: t.innerText, label: t.getAttribute("aria-label") ?? "",
        btn: (document.querySelector(".bill-foot button") as HTMLElement | null)?.innerText ?? "" };
    }).observe(document, { childList: true, subtree: true });
  });
  await context.route("https://test.supabase.co/rest/v1/rpc/delivery_fee_at_v1**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (o.rpcDelay) await new Promise((r) => setTimeout(r, o.rpcDelay));
    if (o.rpcFail) return route.fulfill({ status: 500, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ message: "down" }) });
    const asOf = `2026-11-22T10:0${rpc.length}:00.000Z`;
    rpc.push({ body: route.request().postDataJSON(), asOf });
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ amount_paise: FEE, as_of: asOf, now: asOf }) });
  });
  await context.route("https://test.supabase.co/functions/v1/quote", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = route.request().postDataJSON();
    quotes.push(body);
    if (o.quoteDelay) await new Promise((r) => setTimeout(r, o.quoteDelay));
    if (o.quoteFail) return route.fulfill({ status: 502, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "quote_unavailable" }) });
    const qty = (body.lines ?? []).reduce((n: number, l: { qty: number }) => n + l.qty, 0);
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(quote(qty)) });
  });
  await page.setViewportSize(size);
  await page.goto("/customer/");
  return { net, rpc, quotes };
}
const toBill = async (page: Page) => {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
};
const first = (page: Page) => page.evaluate(() => (window as unknown as { __first?: { rows: string; total: string; btn: string; label: string } }).__first!);
const total = (page: Page) => page.getByTestId("bill-total");
const place = (page: Page) => page.getByRole("button", { name: /Place order/ });

test("F1 the app reads the fee once with no time at start and the quote carries its as_of (AC-1, AC-3)", async ({ page, context }) => {
  const { rpc, quotes } = await open(context, page);
  await expect.poll(() => rpc.length).toBe(1);
  expect(rpc[0].body).toEqual({ p_as_of: null });
  await toBill(page);
  await expect(total(page)).toHaveText("₹345");
  expect(quotes.length).toBeGreaterThan(0);
  for (const q of quotes) expect(q.fee_as_of).toBe(rpc[0].asOf);
});

test("F2 the order carries the same fee_as_of (AC-3)", async ({ page, context }) => {
  const { net, rpc } = await open(context, page);
  await toBill(page);
  await expect(total(page)).toHaveText("₹345");
  await page.getByLabel("Phone").fill("9876543210");
  await place(page).click();
  await expect.poll(() => net.calls.place.length).toBe(1);
  expect(net.calls.place[0].body.fee_as_of).toBe(rpc[0].asOf);
});

test("F3 while the quote is late the first frame of the Bill shows the fee and grey bars, never Free or a wrong sum (AC-2)", async ({ page, context }) => {
  await open(context, page, { quoteDelay: 1500 });
  await toBill(page);
  const f = await first(page);
  expect(f.rows).toContain("25");
  expect(f.rows).not.toContain("Free");
  expect(f.total).not.toMatch(/\d/);   // no number is drawn for the total
  expect(f.btn).not.toMatch(/₹\s?\d/);   // nor on the bottom button
  expect(f.label).toBe("Price loading");   // a screen reader hears that the price is coming, not a number
  await expect(total(page)).toHaveText("₹345", { timeout: 6000 });
  await expect(total(page)).not.toHaveAttribute("aria-label", /.+/);
});

test("F4 Place order does not send while the total is unknown (AC-4 of story 1766 held here)", async ({ page, context }) => {
  const { net } = await open(context, page, { quoteDelay: 1500 });
  await toBill(page);
  await page.getByLabel("Phone").fill("9876543210");
  await expect(place(page)).toBeDisabled();
  await page.waitForTimeout(300);
  expect(net.calls.place.length).toBe(0);
  await expect(total(page)).toHaveText("₹345", { timeout: 6000 });
  await expect(place(page)).toBeEnabled();
});

test("F5 nothing about the fee is written to the phone's storage (AC-1)", async ({ page, context }) => {
  await open(context, page);
  await toBill(page);
  await expect(total(page)).toHaveText("₹345");
  const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
  expect(stored).not.toContain("2026-11-22T10:00");
  expect(stored.toLowerCase()).not.toContain("delivery_fee");
  expect(stored).not.toContain("as_of");
});

test("F6 a fee that could not be read: the quote sends no fee_as_of and the Delivery value is a grey bar, never Free (AC-4)", async ({ page, context }) => {
  const { quotes } = await open(context, page, { rpcFail: true, quoteDelay: 1500 });
  await toBill(page);
  const f = await first(page);
  expect(f.rows).not.toContain("Free");
  expect(f.rows).not.toMatch(/Delivery\s*\d/);
  await expect(total(page)).toHaveText("₹345", { timeout: 6000 });
  expect(quotes.length).toBeGreaterThan(0);
  for (const q of quotes) expect(q.fee_as_of).toBeUndefined();
});

test("F7 a new session reads the fee again (AC-5)", async ({ page, context }) => {
  const { rpc } = await open(context, page);
  await expect.poll(() => rpc.length).toBe(1);
  await page.reload();
  await expect.poll(() => rpc.length).toBe(2);
});

test("F8 a 409 price_changed makes the app read the fee again and the next order carries the new as_of", async ({ page, context }) => {
  const { net, rpc } = await open(context, page);
  await toBill(page);
  await expect(total(page)).toHaveText("₹345");
  await page.getByLabel("Phone").fill("9876543210");
  net.state.reply = { status: 409, body: { ok: false, error: "price_changed", message: "A price changed. Check the bill again.", quote: { ...quote(1), kitchen_id: "k-1" } } };
  await place(page).click();
  await expect.poll(() => rpc.length).toBe(2);
  net.state.reply = null;
  await expect(total(page)).toHaveText("₹345");   // the new as_of makes the app ask again; the mock answers 345 each time
  await place(page).click();
  await expect.poll(() => net.calls.place.length).toBe(2);
  expect(net.calls.place[0].body.fee_as_of).toBe(rpc[0].asOf);
  expect(net.calls.place[1].body.fee_as_of).toBe(rpc[1].asOf);
});

// Rule 23: the bars keep the exact box of the value they replace. Lay the late state over the loaded state: only the figures may differ, nothing moves.
for (const size of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`F9 nothing moves when the total comes, at ${size.width}x${size.height}`, async ({ page, context }) => {
    await open(context, page, { quoteDelay: 1500 }, size);
    await toBill(page);
    const boxes = () => page.evaluate(() => {
      const r = (el: Element | null) => { const b = (el as HTMLElement | null)?.getBoundingClientRect(); return b ? { top: Math.round(b.top), height: Math.round(b.height), left: Math.round(b.left) } : null; };
      return { delivery: r(Array.from(document.querySelectorAll('[aria-label="Items"] .ui-slip-lines > div')).find((d) => d.textContent?.startsWith("Delivery")) ?? null),
        total: r(document.querySelector(".ui-slip-total")), label: r(document.querySelector(".ui-slip-total b")), more: r(document.querySelector(".ui-add-more")), foot: r(document.querySelector(".bill-foot button")) };
    });
    await expect(page.getByTestId("bill-total")).toHaveAttribute("aria-label", "Price loading");
    const late = await boxes();
    await expect(total(page)).toHaveText("₹345", { timeout: 6000 });
    const done = await boxes();
    for (const k of Object.keys(late) as (keyof typeof late)[]) {
      expect(late[k], k).not.toBeNull();
      expect(Math.abs(late[k]!.top - done[k]!.top), `${k} top`).toBeLessThanOrEqual(1);
      expect(Math.abs(late[k]!.height - done[k]!.height), `${k} height`).toBeLessThanOrEqual(1);
      if (k === "label") expect(Math.abs(late[k]!.left - done[k]!.left), "label left").toBeLessThanOrEqual(1);
    }
  });
}

test("F10 while the fee read is still pending the first frame has no Free and no menu total (reviewer, 23 Nov)", async ({ page, context }) => {
  await open(context, page, { rpcDelay: 3500 });
  await toBill(page);
  const f = await first(page);
  expect(f.rows).not.toContain("Free");
  expect(f.rows).not.toMatch(/Delivery\s*\d/);
  expect(f.total).not.toMatch(/\d/);
  expect(f.btn).not.toMatch(/\d/);
  await expect(total(page)).toHaveText("₹345", { timeout: 9000 });
});

// The approved frame: a slim quiet bar (10 to 12 px) centred on the line, as wide as the figure, inside the figure's own box (the box keeps its size, so nothing moves).
const parse = (c: string) => {
  const n = (c.match(/-?[\d.]+/g) ?? []).map(Number);
  return c.startsWith("color(") ? { rgb: n.slice(0, 3).map((v) => Math.round(v * 255)), a: n[3] ?? 1 } : { rgb: n.slice(0, 3), a: n[3] ?? 1 };
};
const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const shapes = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll(".ui-pending")).map((el) => {
  const b = el.getBoundingClientRect(), a = getComputedStyle(el, "::after");
  return { where: el.closest(".bill-foot") ? "button" : el.closest(".ui-slip-total") ? "total" : "delivery", boxH: b.height, boxW: b.width, h: parseFloat(a.height), w: parseFloat(a.width),
    centre: parseFloat(a.top) + parseFloat(a.marginTop) + parseFloat(a.height) / 2 };
}));
const slim = (shape: Awaited<ReturnType<typeof shapes>>[number]) => {
  expect(shape.h, `${shape.where} height`).toBeGreaterThanOrEqual(7);
  expect(shape.h, `${shape.where} height`).toBeLessThanOrEqual(14);
  expect(Math.abs(shape.w - shape.boxW), `${shape.where} width`).toBeLessThanOrEqual(2);   // as wide as the figure
  expect(Math.abs(shape.centre - shape.boxH / 2), `${shape.where} centre`).toBeLessThanOrEqual(2);   // centred on the line
};

test("F11 the total and the button amount are slim bars centred on the line, as wide as the figure, inside the figure's own box", async ({ page, context }) => {
  await open(context, page, { quoteDelay: 2500 });
  await toBill(page);
  await expect(total(page)).toHaveAttribute("aria-label", "Price loading");
  const all = await shapes(page);
  expect(all.map((x) => x.where).sort()).toEqual(["button", "total"]);   // the fee was read, so the Delivery row has the fee, not a bar
  all.forEach(slim);
  expect(all.find((x) => x.where === "total")!.boxH).toBeGreaterThanOrEqual(38);   // the outer box keeps the big figure's line: nothing moves
});

test("F12 the Delivery value is the same slim bar when the fee could not be read", async ({ page, context }) => {
  await open(context, page, { rpcFail: true, quoteDelay: 2500 });
  await toBill(page);
  await expect(total(page)).toHaveAttribute("aria-label", "Price loading");
  const all = await shapes(page);
  expect(all.map((x) => x.where).sort()).toEqual(["button", "delivery", "total"]);
  all.forEach(slim);
});

test("F13 the bar on the bottom button can be seen: 3 to 1 against the button's own fill", async ({ page, context }) => {
  await open(context, page, { quoteDelay: 2500 });
  await toBill(page);
  await expect(total(page)).toHaveAttribute("aria-label", "Price loading");
  const c = await page.evaluate(() => { const el = document.querySelector(".bill-foot .ui-pending")!; return { bar: getComputedStyle(el, "::after").backgroundColor, fill: getComputedStyle(el.closest("button")!).backgroundColor }; });
  const bar = parse(c.bar), fill = parse(c.fill);
  const over = bar.rgb.map((v, i) => Math.round(v * bar.a + fill.rgb[i] * (1 - bar.a)));   // the bar's colour laid over the fill
  expect(contrast(over, fill.rgb), JSON.stringify(c)).toBeGreaterThanOrEqual(3);
});
