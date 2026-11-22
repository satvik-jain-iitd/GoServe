// Story 1658 (owner, 20 Nov 2026, frame j5fb left): a delivered order's foot is Call support (outline) above Share feedback (filled, last), full width.
// No call to the kitchen or the rider, no Order again, no Back to menu. Right after delivery and from History the foot is the same.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const NUMBER = "9000000000";
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const past = () => ({ ...order("delivered", "2020-11-12T14:00:00Z", "2020-11-12T14:00:00Z"), paid_by: "cash" });
const foot = (page: Page) => page.locator(".ui-bottom");
const boxes = async (page: Page) => foot(page).locator("a, button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: e.textContent, ghost: e.classList.contains("ghost") }; }));

async function live(context: Parameters<typeof setup>[0], page: Page, phone: string | null = NUMBER) {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.kitchens = KITCHEN;
  net.state.supportPhone = phone;
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  net.push("UPDATE", past());
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  return net;
}
async function fromHistory(context: Parameters<typeof setup>[0], page: Page) {
  const net = await setup(context, page, [past()]);
  net.state.kitchens = KITCHEN;
  net.state.supportPhone = NUMBER;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("region", { name: "Order, delivered" })).toBeVisible();
  return net;
}

for (const size of SIZES) {
  test(`AC-1 at ${size.width} by ${size.height}: Call support above Share feedback, both full width, nothing else in the foot, no scroll`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await live(context, page);
    await expect(page.getByRole("link", { name: "Call support" })).toBeVisible();
    const b = await boxes(page);
    expect(b.map((x) => x.t)).toEqual(["Call support", "Share feedback"]);
    expect(b[0].ghost).toBe(true);        // outline
    expect(b[1].ghost).toBe(false);       // filled, the main button, last
    expect(Math.abs(b[0].w - b[1].w)).toBeLessThanOrEqual(1);
    expect(Math.abs(b[0].x - b[1].x)).toBeLessThanOrEqual(1);
    expect(b[0].y + b[0].h).toBeLessThanOrEqual(b[1].y);
    for (const t of ["Call the kitchen", "Call the rider"]) await expect(page.getByRole("link", { name: t })).toHaveCount(0);
    for (const t of [/Order again/, "Back to menu"]) await expect(foot(page).getByRole("button", { name: t })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
}

test("AC-2 Call support dials the number the admin set; with no number the button is not there", async ({ page, context }) => {
  await live(context, page);
  await expect(page.getByRole("link", { name: "Call support" })).toHaveAttribute("href", `tel:${NUMBER}`);
  await page.close();
  const p2 = await context.newPage();
  await live(context, p2, null);
  await expect(p2.getByRole("link", { name: "Call support" })).toHaveCount(0);
  await expect(p2.getByRole("button", { name: "Share feedback" })).toBeVisible();
});

test("AC-3 Share feedback opens the feedback sheet tied to this order, and Send saves it with the order", async ({ page, context }) => {
  const net = await live(context, page);
  await page.getByRole("button", { name: "Share feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await page.getByLabel("What happened?").fill("The food was good");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("feedback-sent")).toBeVisible();
  expect(net.calls.feedback).toHaveLength(1);
  expect(net.calls.feedback[0].body).toMatchObject({ p_order: ID, p_text: "The food was good" });
});

test("AC-4 the foot is the same right after delivery and when the order is opened from History", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await live(context, page);
  const a = await boxes(page);
  await page.close();
  const p2 = await context.newPage();
  await p2.setViewportSize({ width: 390, height: 844 });
  await fromHistory(context, p2);
  const b = await boxes(p2);
  expect(a.map((x) => x.t)).toEqual(["Call support", "Share feedback"]);
  expect(b.map((x) => x.t)).toEqual(a.map((x) => x.t));
  b.forEach((x, i) => { for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(x[k] - a[i][k])).toBeLessThanOrEqual(1); });
});
