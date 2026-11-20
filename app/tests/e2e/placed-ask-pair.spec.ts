// Story 1691: the delivered question is a card at the foot, with two equal buttons, "Not yet" left and "Yes, I have it" right.
// Everything is measured in a real browser at three phone sizes. Made-up data only.
import { test, expect, type Page } from "@playwright/test";
import { setup, order } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }];
const card = (page: Page) => page.getByRole("group", { name: "Delivery check" });
const box = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!;

async function open(context: Parameters<typeof setup>[0], page: Page, { asking = true, long = false } = {}) {
  const net = await setup(context, page, [order("out_for_delivery", asking ? "2020-01-01T10:00:00Z" : new Date().toISOString())]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, updated_at: new Date().toISOString() };
  if (long) net.state.orders = [{ ...order("out_for_delivery", "2020-01-01T10:00:00Z"), address: "Flat 4, Green Park, ".repeat(25) }];
  await page.goto("/customer/");
  if (asking) await expect(card(page)).toBeVisible({ timeout: 8000 });
  return net;
}

for (const size of SIZES) {
  test.describe(`${size.width} by ${size.height}`, () => {
    test.beforeEach(async ({ page, context }) => { await page.setViewportSize(size); await open(context, page); });

    test("a to c: Not yet left, equal widths, together they fill the card inside", async ({ page }) => {
      const no = await box(card(page).getByRole("button", { name: "Not yet" }));
      const yes = await box(card(page).getByRole("button", { name: "Yes, I have it" }));
      expect(no.x).toBeLessThan(yes.x);
      expect(Math.abs(no.width - yes.width)).toBeLessThanOrEqual(1);
      const c = await box(card(page));
      const cs = await card(page).evaluate((e) => { const s = getComputedStyle(e); return { l: parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), r: parseFloat(s.paddingRight) + parseFloat(s.borderRightWidth) }; });
      expect(Math.abs(no.x - (c.x + cs.l))).toBeLessThanOrEqual(1);
      expect(Math.abs(yes.x + yes.width - (c.x + c.width - cs.r))).toBeLessThanOrEqual(1);
    });

    test("d, e: the card ends 24 px above the screen edge and is fully in view", async ({ page }) => {
      const c = await box(card(page));
      expect(Math.abs(size.height - (c.y + c.height) - 24)).toBeLessThanOrEqual(1);
      await expect(card(page)).toBeInViewport({ ratio: 1 });
    });

    test("f: 16 px or more between the card and the block above it", async ({ page }) => {
      const c = await box(card(page));
      const above = await card(page).evaluate((e) => { const p = e.previousElementSibling as HTMLElement | null; const r = (p ?? e.closest(".ui-bottom")!.previousElementSibling!).getBoundingClientRect(); return r.bottom; });
      expect(c.y - above).toBeGreaterThanOrEqual(16);
    });

    test("g: the words and both buttons are inside the card", async ({ page }) => {
      await expect(card(page).getByRole("heading", { name: "Was your order delivered?" })).toBeVisible();
      await expect(card(page).getByRole("button")).toHaveText(["Not yet", "Yes, I have it"]);
      await expect(page.locator(".ui-bottom").getByRole("group", { name: "Delivery check" })).toHaveCount(1);
    });
  });
}

test("h: on a long page the card stays in view at the top and in the middle", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(context, page, { long: true });
  await page.addStyleTag({ content: "html { font-size: 24px; } .ui-slip-body { min-height: 1400px; }" });
  expect(await page.locator(".ui-scroll").evaluate((e) => e.scrollHeight - e.clientHeight)).toBeGreaterThan(400);   // the page content is far longer than the screen
  for (const y of [0, 400]) {
    await page.locator(".ui-scroll").evaluate((e, v) => { e.scrollTop = v; }, y);
    await expect(card(page)).toBeInViewport({ ratio: 1 });
  }
});

test("i: the slip does not move when the question appears", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(context, page, { asking: false });
  await expect(card(page)).toHaveCount(0);
  const off = await box(page.locator(".ui-slip").first());
  const off2 = await box(page.getByRole("list", { name: "Order progress" }));
  await page.close();
  const p2 = await context.newPage();
  await p2.setViewportSize({ width: 390, height: 844 });
  await open(context, p2);
  const on = await box(p2.locator(".ui-slip").first());
  const on2 = await box(p2.getByRole("list", { name: "Order progress" }));
  expect(Math.abs(on.y - off.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(on2.y - off2.y)).toBeLessThanOrEqual(1);
});
