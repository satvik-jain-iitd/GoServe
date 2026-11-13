// Story 1182 (owner, 13 Nov 2026, DECIDED, board RX3): the rider's "On the way" screen shows only what a rider needs. Round Call and Navigate
// beside the name, the note, the amount, a quiet "Could not deliver?" link, and one button at a time (story 1182, RY1 to RY3). No kitchen name, no stamp, no phone digits.
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

test("RX3.4 the bottom zone holds one button (story 1182, RY2); Could not deliver? starts the not-delivered path", async ({ page, context }) => {
  await open(page, context);
  const buttons = page.locator(".ui-bottom button");
  await expect(buttons).toHaveCount(1);
  await expect(buttons).toHaveText("Arriving · tell Rahul");
  await expect(page.getByRole("button", { name: /^Not delivered/ })).toHaveCount(0);
  page.once("dialog", (d) => void d.dismiss());
  await page.getByRole("button", { name: "Could not deliver?" }).click();
});

test("RX3.5 at 360 x 640 the bottom button is in view without a scroll", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, context, job({ instructions: "Ring the bell twice, gate is blue" }));
  for (const name of [/^Arriving/]) {
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

// Review of PR 1186 (13 Nov 2026): the longest legal inputs must never push the buttons or the tabs off a short screen.
const words = (n: number, w: string) => Array.from({ length: Math.ceil(n / (w.length + 1)) }, () => w).join(" ").slice(0, n);
test("RX3.7 at 360 x 640 with the longest legal address and a 200-letter note, the slip scrolls and Arriving, then Collect, can be tapped", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const address = `${words(120, "House")}, ${words(120, "Landmark")}, Lajpat Nagar II, South East Delhi, Delhi 110024`;
  const net = await open(page, context, job({ address, instructions: words(200, "Ring") }));
  const inView = async (name: RegExp) => { const b = (await page.getByRole("button", { name }).boundingBox())!; expect(b.y + b.height).toBeLessThanOrEqual(640); };
  const tabs = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
  expect(tabs.y + tabs.height).toBeLessThanOrEqual(640);
  await inView(/^Arriving/);   // story 1182 layer 2: one button at a time, Arriving then Collect
  await page.getByRole("button", { name: /^Arriving/ }).click();
  await inView(/^Collect ₹/);
  await page.getByRole("button", { name: /^Collect ₹/ }).click();
  await expect(page.getByRole("region", { name: /^Collect payment/ })).toBeVisible();
  expect(net.calls.status.filter((c) => c.body.action === "deliver")).toEqual([]);
});

test("RX3.8 Could not deliver? is a left, 14 px, regular, underlined link with a 44 px tap height", async ({ page, context }) => {
  await open(page, context);
  const link = page.getByRole("button", { name: "Could not deliver?" });
  const st = await link.evaluate((el) => { const c = getComputedStyle(el); return { size: c.fontSize, weight: c.fontWeight, line: c.textDecorationLine }; });
  expect(st).toEqual({ size: "14px", weight: "400", line: "underline" });
  const b = (await link.boundingBox())!;
  expect(b.height).toBeGreaterThanOrEqual(44);
  const slip = (await page.locator(".ui-slip").first().boundingBox())!;
  expect(b.x - slip.x).toBeLessThanOrEqual(20);   // left, at the slip's padding
});

test("RX3.9 Call has a 1.5 px ring, Navigate an outline 22 px arrow, and Note is small mono text", async ({ page, context }) => {
  await open(page, context, job({ instructions: "Ring the bell twice" }));
  expect(await page.getByRole("link", { name: "Call Rahul" }).evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/ 0px 0px 0px 1\.5px inset$/);
  const arrow = page.getByRole("link", { name: "Navigate" }).locator("svg");
  expect(await arrow.getAttribute("width")).toBe("22");
  expect(await arrow.getAttribute("fill")).toBe("none");
  const key = page.locator(".ui-rx-note").getByText("Note ·");
  const st = await key.evaluate((el) => { const c = getComputedStyle(el); return { size: c.fontSize, mono: /mono/i.test(c.fontFamily) }; });
  expect(st).toEqual({ size: "12px", mono: true });
});
