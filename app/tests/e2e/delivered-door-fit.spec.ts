// Story 1677 (owner, 19 Nov 2026: "Scroll minimum, buttons not hidden"): Delivered and the rider at the door fit a common phone with no scroll.
// Measured in the browser: document scroll height against the viewport, and the main button's box inside the viewport.
import { test, expect, type Page } from "@playwright/test";
import { setup, order, ID } from "./helpers";

const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const list = (page: Page) => page.getByRole("list", { name: "Order progress" });

async function open(context: Parameters<typeof setup>[0], page: Page, door: boolean) {
  const net = await setup(context, page, [order("out_for_delivery")]);
  net.state.kitchens = KITCHEN;
  net.state.supportPhone = "9000000000";
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  net.state.tracking = { rider_lat: 28.58, rider_lng: 77.25, updated_at: new Date().toISOString() };
  await page.goto("/customer/");
  await expect(list(page)).toBeVisible();
  if (door) {
    const arriving = { id: "e1", order_id: ID, event: "order.arriving" };
    net.state.events = [arriving];
    net.push("INSERT", arriving, "order_events");
    await expect(list(page).getByText("Rider at your door")).toBeVisible();
  } else {
    net.push("UPDATE", order("delivered", "2020-01-01T10:09:00Z"));
    await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  }
  await page.waitForTimeout(500);   // the rows finish sliding
}

for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }])
  for (const door of [false, true])
    test(`F1 ${door ? "rider at the door" : "delivered"} at ${size.width} by ${size.height}: no scroll, main button inside the screen`, async ({ page, context }) => {
      await page.setViewportSize(size);
      await open(context, page, door);
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: window.innerHeight, over: Math.max(...[...document.querySelectorAll("*")].map((e) => (e as HTMLElement).scrollHeight - (e as HTMLElement).clientHeight)) }));
      expect(m.scroll).toBeLessThanOrEqual(m.inner);
      const main = (await page.locator(".ui-bottom .ui-btn").last().boundingBox())!;
      expect(main.y).toBeGreaterThanOrEqual(0);
      expect(main.y + main.height).toBeLessThanOrEqual(size.height);
      expect(main.x + main.width).toBeLessThanOrEqual(size.width);
    });
