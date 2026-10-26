// Story H10d (#193): Your orders (08, 08e) and You (09) of the Ink v3 boards. The network is answered by the test.
import { test, expect, type Page } from "@playwright/test";
import { order, setup, scan as axeScan } from "./helpers";

const you = (page: Page) => page.getByRole("button", { name: "You (Account)" });
const KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, opens_at: "00:00:00", closes_at: "23:59:00" };

test("S1 a tap on a slip opens it, a delivered one offers Order again", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", "2020-01-01T11:00:00Z"), paid_by: "cash" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "My orders" }).click();
  await expect(page.getByText("1 order", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Order again" })).toBeVisible();
});

test("S2 You shows the details, and Edit delivery details changes them", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.customer = { user_id: "u", name: "Asha", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" };
  await page.goto("/customer/");
  await you(page).click();
  await page.getByRole("button", { name: "Edit delivery details" }).click();
  await page.getByLabel("Your name").fill("Asha Rao");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("account")).toContainText("Asha Rao");
});

test("S3 the Look chips pin Night, and Day takes the pin away; no clock chip (#225)", async ({ page, context }) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 23, 0, 0) });   // 23:00: still Day with no pin
  await setup(context, page);
  await page.goto("/customer/");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("day");
  await you(page).click();
  await expect(page.getByRole("button", { name: /By the clock/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Night", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("night");
  expect(await page.evaluate(() => localStorage.getItem("gs-theme"))).toBe("night");
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("night");   // the pin survives a reload
  await you(page).click();
  await page.getByRole("button", { name: "Day", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("day");
  expect(await page.evaluate(() => localStorage.getItem("gs-theme"))).toBeNull();   // Day is the default, not a pin
});

test("S4 with an order open, You shows a strip that opens the tracker", async ({ page, context }) => {
  await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Back to menu" }).click();   // an open order lands on its tracker first
  await you(page).click();
  await page.getByRole("button", { name: /No\. 0f0f0f0f/ }).click();
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
});

test("S5 Send feedback opens the Feedback sheet", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await you(page).click();
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
});

test("S6 Forget me asks first, then wipes what the phone remembers", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });   // seed the pin once by hand, so the reload after the wipe shows what the phone really kept
  await page.goto("/customer/");
  await page.evaluate(() => localStorage.setItem("gs-pin", "110016"));
  await page.reload();
  await you(page).click();
  await page.getByRole("button", { name: "Forget me on this phone" }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBe("110016");
  await page.getByRole("button", { name: "Forget me on this phone" }).click();
  await page.getByRole("button", { name: "Yes, forget" }).click();
  await expect(page.getByRole("heading", { name: "Where do we deliver?" })).toBeVisible();   // after the reload the phone asks for the pin again
  expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBeNull();
});

test("S7 Use on another phone copies the link", async ({ page, context }) => {
  await context.addInitScript(() => { (window as any).__copied = ""; Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => { (window as any).__copied = t; } }, configurable: true }); Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
  await setup(context, page);
  await page.goto("/customer/");
  await you(page).click();
  await page.getByRole("button", { name: "Use on another phone" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copied)).toContain("join=");
});

for (const t of ["day", "night"] as const) {
  test(`S8 Your orders and You have no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    const net = await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
    net.state.kitchens = [KITCHEN];
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Back to menu" }).click();
    await you(page).click();
    await expect(page.getByRole("heading", { name: "You", exact: true })).toBeVisible();
    const scan = () => axeScan(page);
    expect(await scan()).toEqual([]);
    await page.getByRole("button", { name: "My orders" }).click();
    await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
    expect(await scan()).toEqual([]);
  });
}

test("M.1 You shows which build this phone runs", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await you(page).click();
  await expect(page.getByText(/^Build (dev|[0-9a-f]{7})$/)).toBeVisible();   // so the founder can tell an old build from a new one
});
