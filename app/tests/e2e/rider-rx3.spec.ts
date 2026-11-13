// Story 1182 (owner, 13 Nov 2026, DECIDED, board RX3): the rider's "On the way" screen shows only what a rider needs. Round Call and Navigate
// beside the name, the note, the amount, a quiet "Could not deliver?" link, and "Delivered" last. No kitchen name, no stamp, no phone digits.
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const KITCHEN = { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" };
const PIN = { drop_lat: 28.5677, drop_lng: 77.2432 };
const job = (extra: Record<string, unknown> = {}) => ({ ...order("out_for_delivery"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", ...PIN, ...extra });
const open = async (page: Page, context: Parameters<typeof setup>[0], o = job()) => {
  const net = await setup(context, page, [o]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  return net;
};

test("RX3.1 the header says On the way while out for delivery", async ({ page, context }) => {
  await open(page, context);
  await expect(page.getByRole("heading", { name: "On the way", exact: true })).toBeVisible();
  await expect(page.getByText(/^No\. /).first()).toBeVisible();
  await expect(page.getByText("Tau Ka Dhaba")).toHaveCount(0);   // no kitchen name
  await expect(page.getByText(/^Picked up /)).toHaveCount(0);
  await expect(page.getByText("Deliver to", { exact: true })).toHaveCount(0);
});

test("RX3.2 Navigate opens directions to the order's pin; an order with no pin has no Navigate button", async ({ page, context }) => {
  await open(page, context);
  const nav = page.getByRole("link", { name: "Navigate" });
  await expect(nav).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=28.5677,77.2432&travelmode=two-wheeler");
  await expect(nav).toHaveText("");   // no words on the round button
});

test("RX3.2b an order with no pin has no Navigate button", async ({ page, context }) => {
  await open(page, context, job({ drop_lat: null, drop_lng: null }));
  await expect(page.getByRole("link", { name: "Navigate" })).toHaveCount(0);
});

test("RX3.3 the phone digits are not on the screen; Call still dials the customer", async ({ page, context }) => {
  await open(page, context);
  await expect(page.getByText("9876543210")).toHaveCount(0);
  const call = page.getByRole("link", { name: "Call Rahul" });
  await expect(call).toHaveAttribute("href", "tel:9876543210");
  await expect(call).toHaveText("");
});

test("RX3.4 Delivered is the last button; Could not deliver? starts the not-delivered path", async ({ page, context }) => {
  await open(page, context);
  const buttons = page.locator(".ui-bottom button");
  await expect(buttons.last()).toHaveText("Delivered");
  await expect(page.getByRole("button", { name: /^Not delivered/ })).toHaveCount(0);
  page.once("dialog", (d) => void d.dismiss());
  await page.getByRole("button", { name: "Could not deliver?" }).click();
});

test("RX3.5 at 360 x 640 the two bottom buttons are in view without a scroll", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, context, job({ instructions: "Ring the bell twice, gate is blue" }));
  for (const name of [/^Arriving/, /^Delivered/]) {
    const b = (await page.getByRole("button", { name }).first().boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(640);
  }
});

test("RX3.6 the round buttons are 48 px with at least 8 px between them", async ({ page, context }) => {
  await open(page, context);
  const call = (await page.getByRole("link", { name: "Call Rahul" }).boundingBox())!;
  const nav = (await page.getByRole("link", { name: "Navigate" }).boundingBox())!;
  for (const b of [call, nav]) { expect(Math.round(b.width)).toBe(48); expect(Math.round(b.height)).toBe(48); }
  expect(nav.x - (call.x + call.width)).toBeGreaterThanOrEqual(8);
});
