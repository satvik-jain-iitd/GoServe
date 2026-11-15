// Story 1557: a long address stays inside its card and the screen never scrolls sideways. Shared by the Chromium and the WebKit spec.
// Sample words only, never a real address.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const BASE = "Flat 4, Sample Garden Colony, Sample Road, near Sample Temple, Sampletown, Sample State 900001, opposite Sample Park Way";   // 120 characters
export const LONG = [
  { name: "120 characters", text: BASE },
  { name: "one 40 character word", text: `Flat 4, ${"Samplewordwithnogaps".repeat(2)}, Sampletown` },
];
export const WIDTHS = [360, 390];

const NOW = new Date().toISOString();
const IDS = [ID, "0a0a0a0a-1111-4222-8333-444444444444", "0b0b0b0b-1111-4222-8333-444444444444"];
const KITCHEN = { id: "k", name: "Sample Kitchen", address: "Sample Road", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
export const job = (status: string, address: string, i = 0) => ({ ...order(status, NOW, new Date(Date.now() - (60 - i) * 60_000).toISOString()), id: IDS[i], rider_id: SESSION, customer_name: "Sample Customer", customer_phone: "9876543210", address });

// The page and every scroll area: how many pixels each is wider than its own box. Nothing may be above 0.
export async function expectNoSideScroll(page: Page, what: string) {
  await page.evaluate(() => document.fonts.ready);
  const wide = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrolls: [...document.querySelectorAll<HTMLElement>(".ui-scroll")].map((el) => el.scrollWidth - el.clientWidth),
  }));
  expect(wide.page, `${what}: the page is ${wide.page}px wider than the screen`).toBeLessThanOrEqual(0);
  for (const w of wide.scrolls) expect(w, `${what}: the scroll area is ${w}px wider than its box`).toBeLessThanOrEqual(0);
}

// The element sits inside the card, left and right (half a pixel of rounding allowed).
export async function expectInside(page: Page, inner: string, card: string, what: string) {
  const [a, b] = await Promise.all([page.locator(inner).first().boundingBox(), page.locator(card).first().boundingBox()]);
  if (!a || !b) throw new Error(`${what}: ${inner} or ${card} is not on the screen`);
  expect(a.x + a.width, `${what}: ${inner} ends at ${a.x + a.width}px, the card ends at ${b.x + b.width}px`).toBeLessThanOrEqual(b.x + b.width + 0.5);
  expect(a.x, `${what}: ${inner} starts left of the card`).toBeGreaterThanOrEqual(b.x - 0.5);
}

const lines = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => {
  const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2;
  return el.getBoundingClientRect().height / lh;
});

const openRider = async (context: BrowserContext, page: Page, orders: object[], size: { width: number; height: number }) => {
  await page.setViewportSize(size);
  const net = await setup(context, page, orders);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
};

export function riderLongAddress() {
  for (const width of WIDTHS) for (const a of LONG) {
    const at = `${width}px, ${a.name}`;
    test(`rider Pick up, ${at}: the address wraps inside the card and the amount stays in it`, async ({ page, context }) => {
      await openRider(context, page, [job("ready", a.text)], { width, height: 780 });
      await expect(page.locator(".ui-pick-addr")).toHaveText(a.text);
      await expectNoSideScroll(page, `Pick up ${at}`);
      expect(await lines(page, ".ui-pick-addr"), "the address is more than one line high").toBeGreaterThan(1.5);
      await expectInside(page, ".ui-pick-addr", ".ui-slip", `Pick up ${at}`);
      await expectInside(page, ".ui-slip-total span", ".ui-slip", `Pick up ${at}`);
    });

    test(`rider trip list, ${at}: every address stays inside the card`, async ({ page, context }) => {
      await openRider(context, page, [0, 1, 2].map((i) => job("ready", a.text, i)), { width, height: 780 });
      await expect(page.locator(".ui-tick-addr")).toHaveCount(3);
      await expectNoSideScroll(page, `trip ${at}`);
      expect(await lines(page, ".ui-tick-addr"), "the address is more than one line high").toBeGreaterThan(1.5);
      await expectInside(page, ".ui-tick-addr", ".ui-slip", `trip ${at}`);
      await expectInside(page, ".ui-slip-total span", ".ui-slip", `trip ${at}`);
    });

    test(`rider On the way, ${at}: the address stays beside the round buttons`, async ({ page, context }) => {
      await openRider(context, page, [job("out_for_delivery", a.text)], { width, height: 780 });
      await expect(page.locator(".ui-deliver")).toContainText(a.text);
      await expectNoSideScroll(page, `On the way ${at}`);
      await expectInside(page, ".ui-deliver", ".ui-slip", `On the way ${at}`);
      await expectInside(page, ".ui-rx-acts", ".ui-slip", `On the way ${at}`);
    });

    test(`rider Today, ${at}: the delivered row stays inside the screen`, async ({ page, context }) => {
      await openRider(context, page, [{ ...job("delivered", a.text), paid_by: "cash" }], { width, height: 780 });
      await page.getByRole("button", { name: "Today", exact: true }).click();
      const row = page.locator(".ui-row", { hasText: `No. ${ID.slice(0, 8)}` });
      await expect(row).toContainText(a.text);
      await expectNoSideScroll(page, `Today ${at}`);
      const box = (await row.boundingBox())!;
      expect(box.x + box.width, `Today ${at}: the row ends at ${box.x + box.width}px`).toBeLessThanOrEqual(width + 0.5);
      const end = (await row.locator(".ui-row-end").boundingBox())!;
      expect(end.x + end.width, `Today ${at}: the amount ends at ${end.x + end.width}px`).toBeLessThanOrEqual(width + 0.5);
    });
  }

  // The reviewer's case: a short phone, an address of three lines. The button stays at the foot, whole; the card is reached by scrolling inside the scroll area.
  test("rider Pick up on a 360 by 640 phone, an address of 3 lines: Picked up stays at the bottom, fully on the screen", async ({ page, context }) => {
    const size = { width: 360, height: 640 };
    await openRider(context, page, [job("ready", LONG[0].text)], size);
    await expect(page.locator(".ui-pick-addr")).toHaveText(LONG[0].text);
    expect(await lines(page, ".ui-pick-addr"), "the address takes three lines or more").toBeGreaterThanOrEqual(2.9);
    await expectNoSideScroll(page, "Pick up 360x640");
    const button = page.locator(".ui-bottom button");
    await expect(button).toHaveText(["Picked up"]);
    const b = (await button.boundingBox())!;
    const nav = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;   // the tabs are the last thing on the screen; the button sits right on top of them
    expect(nav.y + nav.height, `the tabs end at ${nav.y + nav.height}px on a ${size.height}px screen`).toBeLessThanOrEqual(size.height + 0.5);
    expect(b.y + b.height, `the button ends at ${b.y + b.height}px, the tabs start at ${nav.y}px`).toBeLessThanOrEqual(nav.y + 0.5);
    expect(nav.y - (b.y + b.height), "the button sits at the foot, with only the foot bar's own padding under it").toBeLessThanOrEqual(32);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(size.width);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), "the page itself does not scroll down").toBeLessThanOrEqual(0);
    // The last line of the card (the amount) is reachable: after a scroll inside the scroll area it sits above the foot bar.
    const total = page.locator(".ui-slip-total");
    await total.scrollIntoViewIfNeeded();
    const t = (await total.boundingBox())!;
    const foot = (await page.locator(".ui-bottom").boundingBox())!;
    expect(t.y + t.height, `the amount ends at ${t.y + t.height}px, the foot bar starts at ${foot.y}px`).toBeLessThanOrEqual(foot.y + 0.5);
    await expect(button).toBeEnabled();
  });
}
