// Story 1668 layer B (owner frame hc-customer-onway, 20 Nov 2026): on the way, the customer sees a Delivery code box when the server answers order_code_v1 with a drop code.
// No code (switch off, any other answer, a failed or slow read): no box, no error text, the screen as today. The rpc is mocked here.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const box = (page: Page) => page.getByTestId("delivery-code");
type Answer = { status: number; body: unknown; delayMs?: number };

async function open(context: BrowserContext, page: Page, status: string, answer: { current: Answer }) {
  const net = await setup(context, page, [order(status)]);
  net.state.kitchens = KITCHEN;
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  const reads: string[] = [];
  await context.route("**/rest/v1/rpc/order_code_v1*", async (route) => {
    reads.push(route.request().postData() ?? "");
    if (answer.current.delayMs) await new Promise((r) => setTimeout(r, answer.current.delayMs));
    await route.fulfill({ status: answer.current.status, contentType: "application/json", body: JSON.stringify(answer.current.body) }).catch(() => {});
  });
  await page.goto("/customer/");
  await expect(page.getByRole("region", { name: /^Order/ }).first()).toBeVisible();
  return { net, reads };
}
const OK: Answer = { status: 200, body: { ok: true, role: "customer", drop_code: "4729" } };
const NONE: Answer = { status: 200, body: { ok: false, error: "no_code", message: "No code for you on this order." } };

test("1668B the box shows the code on the way, as text with spacing from CSS", async ({ page, context }) => {
  await open(context, page, "out_for_delivery", { current: OK });
  await expect(box(page)).toBeVisible();
  await expect(box(page)).toContainText("Delivery code");
  await expect(box(page)).toContainText("Tell it to the rider when the food is in your hands.");
  const digits = box(page).getByText("4729", { exact: true });
  await expect(digits).toBeVisible();
  expect(parseFloat(await digits.evaluate((e) => getComputedStyle(e).letterSpacing))).toBeGreaterThan(0);
  expect(await page.title()).not.toContain("4729");
});

test("1668B no_code (switch off): no box and no error text", async ({ page, context }) => {
  await open(context, page, "out_for_delivery", { current: NONE });
  await expect(page.getByTestId("rider-card")).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByText("No code for you")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("1668B a failed read and a slow read: no box, no error; a new read on the next status change shows it", async ({ page, context }) => {
  const answer = { current: { status: 500, body: { message: "boom" } } as Answer };
  const { net, reads } = await open(context, page, "out_for_delivery", answer);
  await expect.poll(() => reads.length).toBe(1);
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  net.push("UPDATE", order("ready", "2020-01-01T10:06:00Z"));
  answer.current = { ...OK, delayMs: 1500 };   // slow
  net.push("UPDATE", order("out_for_delivery", "2020-01-01T10:07:00Z"));
  await expect.poll(() => reads.length).toBe(2);
  await expect(box(page)).toHaveCount(0);       // still waiting: nothing, no spinner text
  await expect(box(page)).toBeVisible({ timeout: 5000 });
  await expect(box(page)).toContainText("4729");
});

test("1668B no box before the way and none after delivered", async ({ page, context }) => {
  const { net, reads } = await open(context, page, "ready", { current: OK });
  await expect(box(page)).toHaveCount(0);
  expect(reads.length).toBe(0);
  net.push("UPDATE", order("out_for_delivery", "2020-01-01T10:07:00Z"));
  await expect(box(page)).toBeVisible();
  net.push("UPDATE", order("delivered", "2020-01-01T10:09:00Z"));
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  await expect(box(page)).toHaveCount(0);
});

for (const size of SIZES) {
  test(`1668B at ${size.width} by ${size.height}: the box fills the empty room, other boxes equal within 1 px, no scroll, foot in view`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const answer = { current: NONE };
    const { reads } = await open(context, page, "out_for_delivery", answer);
    await expect.poll(() => reads.length).toBe(1);
    const read = async () => ({
      slip: (await page.locator(".ui-slip").first().boundingBox())!,
      card: (await page.getByTestId("rider-card").boundingBox())!,
      foot: (await page.getByRole("link", { name: "Call the rider" }).boundingBox())!,
      fit: await page.evaluate(() => ({ s: document.documentElement.scrollHeight, h: innerHeight })),
    });
    await expect(page.getByRole("link", { name: "Call the rider" })).toBeVisible();
    const off = await read();
    answer.current = OK;
    await page.reload();
    await expect.poll(() => reads.length).toBe(2);
    await expect(box(page)).toBeVisible();
    const on = await read();
    for (const n of ["slip", "card", "foot"] as const) for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(on[n][k] - off[n][k]), `${n}.${k}`).toBeLessThanOrEqual(1);
    expect(on.fit.s).toBeLessThanOrEqual(on.fit.h);                       // the 1677 guard: nothing scrolls
    expect(on.foot.y + on.foot.height).toBeLessThanOrEqual(size.height);  // the foot button is inside the screen
    if (size.width === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1668-delivery-code-390x844.png" });
  });
}
