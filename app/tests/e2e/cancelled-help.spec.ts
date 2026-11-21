// Story 1745 (owner, 20 Nov 2026, frame j7can): a cancelled order's page says each fact once, offers Call support above Share feedback, and goes back to History.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const NUMBER = "9000000000";
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const gone = () => ({ ...order("cancelled", "2020-11-12T14:05:00Z", "2020-11-12T14:00:00Z"), cancelled_by: "customer" });
const foot = (page: Page) => page.locator(".ui-bottom");

async function live(context: Parameters<typeof setup>[0], page: Page) {
  const net = await setup(context, page, [order("placed")]);
  net.state.supportPhone = NUMBER;
  Object.assign(net.state.kitchens[0], { phone: "9876543210" });   // a kitchen with a phone: its call must not show on a finished order
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", gone());
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  return net;
}
async function fromHistory(context: Parameters<typeof setup>[0], page: Page) {
  const net = await setup(context, page, [gone()]);
  net.state.supportPhone = NUMBER;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  return net;
}

test("AC-1 the title is Your order and the word Cancelled shows once, in the stamp", async ({ page, context }) => {
  await live(context, page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your order");
  await expect(page.getByText(/cancelled/i)).toHaveCount(2);   // the stamp and the line "Cancelled at hh:mm" are two facts; no title, no sentence
  await expect(page.locator(".ui-stamp")).toHaveText("Cancelled");
});

test("AC-2 Cancelled at hh:mm shows under the stamp and the order number shows once", async ({ page, context }) => {
  await live(context, page);
  const at = page.getByText(/^Cancelled at \d{1,2}:\d{2} (am|pm)$/i);
  await expect(at).toBeVisible();
  expect((await at.boundingBox())!.y).toBeGreaterThan((await page.locator(".ui-stamp").boundingBox())!.y);
  await expect(page.getByText(/No\. 0f0f0f0f/)).toHaveCount(1);
  await expect(page.locator(".ui-slip-head")).toContainText(/\d{1,2} \w{3} \d{1,2}:\d{2} (am|pm)/i);   // the slip head holds the order's date and time on the right
});

test("AC-3 the sentence Your order was cancelled. Nothing to pay. is gone; Nothing to pay shows once", async ({ page, context }) => {
  await live(context, page);
  await expect(page.getByText("Your order was cancelled")).toHaveCount(0);
  await expect(page.getByText("Nothing to pay")).toHaveCount(1);
});

for (const size of SIZES) {
  test(`AC-4 at ${size.width} by ${size.height}: Call support above Share feedback, both full width, no Back to menu, no scroll`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await live(context, page);
    const b = await foot(page).locator("a, button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: r.y, w: r.width, h: r.height, t: e.textContent, ghost: e.classList.contains("ghost") }; }));
    expect(b.map((x) => x.t)).toEqual(["Call support", "Share feedback"]);
    expect([b[0].ghost, b[1].ghost]).toEqual([true, false]);
    expect(Math.abs(b[0].w - b[1].w)).toBeLessThanOrEqual(1);
    expect(b[0].y + b[0].h).toBeLessThanOrEqual(b[1].y);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
}

test("AC-5 Share feedback opens the sheet tied to this order, and Send saves it with the order", async ({ page, context }) => {
  const net = await live(context, page);
  await page.getByRole("button", { name: "Share feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await page.getByLabel("What happened?").fill("I changed my mind");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("feedback-sent")).toBeVisible();
  expect(net.calls.feedback[0].body).toMatchObject({ p_order: ID, p_text: "I changed my mind" });
});

test("AC-6 an order opened from History goes back to History on the header arrow", async ({ page, context }) => {
  await fromHistory(context, page);
  await page.locator(".ui-head").getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
});

test("AC-6 an order opened from History goes back to History on the phone's Back button", async ({ page, context }) => {
  await fromHistory(context, page);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
});
