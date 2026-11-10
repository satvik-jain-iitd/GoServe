// Regression, screen 17: L4d Kitchen closed. Cases: .claude/handoff/qa/screens/17-L4d.md (epic #1196, story #1197). Reached with setup() and kitchens[0].open = false (TC 17.6 is drift, backlog, not automated).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "../helpers";

test.use({ viewport: { width: 390, height: 844 } });

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const DISHES = [
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, available: true },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, available: true },
];
const add = (page: Page, name: string) => page.getByRole("button", { name: `Add ${name}` });
const closedStamp = (page: Page) => page.locator(".ui-closed .ui-stamp");
const tell = (page: Page) => page.getByRole("button", { name: "Tell me when it opens" });

// A phone that allows alerts and counts how often it is asked (installed before the page opens). The push is stubbed.
async function phone(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __asks: number };
    w.__asks = 0;
    Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => { w.__asks++; return "granted"; };
    const fake = { pushManager: { subscribe: async () => ({ toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "PKEY", auth: "AKEY" } }) }), getSubscription: async () => null } };
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  });
}
const asks = (page: Page) => page.evaluate(() => (window as unknown as { __asks: number }).__asks);

test("TC 17.1 the kitchen is closed: the Closed stamp, Kitchen closed. Opens at 6:00 pm, and Tell me when it opens", async ({ page, context }) => {
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], { open: false, opens_at: "18:00:00" });
  await page.goto("/customer/");
  await expect(closedStamp(page)).toHaveText("Closed");
  await expect(page.getByText("Kitchen closed. Opens at 6:00 pm.")).toBeVisible();
  await expect(page.getByText("Order from 6:00 pm.")).toBeVisible();
  await expect(tell(page)).toBeVisible();
});

test("TC 17.2 the closed menu: no Add on any dish, no View bill bar, the list grey and the names muted", async ({ page, context }) => {
  await context.route("https://img.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  const net = await setup(context, page);
  net.state.menu = DISHES.map((d) => ({ ...d, image_url: "https://img.test/" + d.id + ".png" }));
  Object.assign(net.state.kitchens[0], { open: false });
  await page.goto("/customer/");
  await expect(closedStamp(page)).toHaveText("Closed");
  // The list is on screen, so the "no Add" count below is checked against live rows.
  await expect(page.getByRole("button", { name: "Butter Chicken details" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Dal Makhani details" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  // Grey list: the container, the photos (grayscale) and the names in the muted colour.
  await expect(page.locator(".ui-list.closed-grey")).toHaveCount(1);
  await expect.poll(async () => page.locator(".closed-grey img").evaluateAll((els) => els.map((e) => getComputedStyle(e).filter))).toEqual(expect.arrayContaining(["grayscale(1)"]));
  const muted = await page.evaluate(() => {
    const t = document.createElement("i");
    t.style.color = "var(--gs-text-muted)";
    document.body.append(t);
    const c = getComputedStyle(t).color;
    t.remove();
    return c;
  });
  const name = await page.locator(".ui-list.closed-grey h3").first().evaluate((e) => getComputedStyle(e).color);
  expect(name).toBe(muted);
});

test("TC 17.3 Tell me when it opens: alerts asked once, then the button says it will tell me", async ({ page, context }) => {
  await phone(context);
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], { open: false });
  await page.goto("/customer/");
  await expect(tell(page)).toBeVisible();
  await tell(page).click();
  await expect(page.getByText("We will tell you when it opens.")).toBeVisible();
  await expect(tell(page)).toHaveCount(0);
  expect(await asks(page)).toBe(1);
  expect(net.calls.rpc.filter((c) => c.name === "open_alert_add_v2").map((c) => c.body)).toEqual([{ p_kitchen: "k-1" }]);
});

test("TC 17.4 the kitchen closes while I have 2 items in the bill: the bill is cleared and I land on the closed menu", async ({ page, context }) => {
  await page.clock.setFixedTime(new Date("2026-10-24T06:30:00Z"));   // 12:00 India, outside the closing hours below
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await add(page, "Butter Chicken").click();
  await add(page, "Dal Makhani").click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Dal Makhani").first()).toBeVisible();
  Object.assign(net.state.kitchens[0], { open: false, opens_at: "18:00:00", closes_at: "22:00:00" });
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0, { timeout: 5000 });
  await expect(closedStamp(page)).toHaveText("Closed");
  await expect(page.getByRole("status").filter({ hasText: "The kitchen just closed. Your bill was cleared. Order again from 6:00 pm." })).toBeVisible();
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
});

test("TC 17.5 the kitchen opens while I look: the menu turns live without a reload", async ({ page, context }) => {
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], { open: false });
  await page.goto("/customer/");
  await expect(closedStamp(page)).toHaveText("Closed");
  await expect(page.getByRole("button", { name: "Butter Chicken details" }).first()).toBeVisible();   // live rows: the Add count is real
  await expect(add(page, "Butter Chicken")).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { __marker: string }).__marker = "same page"; });   // a reload would clear this
  Object.assign(net.state.kitchens[0], { open: true });
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(add(page, "Butter Chicken")).toBeVisible({ timeout: 5000 });
  await expect(closedStamp(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __marker?: string }).__marker)).toBe("same page");
});
