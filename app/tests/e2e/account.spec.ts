// Story H10d (#193): Your orders (08, 08e) and You (09) of the Ink v3 boards. The network is answered by the test.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { order, setup } from "./helpers";

const you = (page: Page) => page.getByRole("button", { name: "You (Account)" });
const KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, opens_at: "10:00:00", closes_at: "22:00:00" };

test("S1 a tap on a slip opens it, a delivered one offers Order again", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", "2020-01-01T11:00:00Z"), paid_by: "cash" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "My orders" }).click();
  await expect(page.getByText("1 slip", { exact: true })).toBeVisible();
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

test("S3 the Look chips pin Day or Night, and By the clock lets go of the pin", async ({ page, context }) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 12, 0, 0) });
  await setup(context, page);
  await page.goto("/customer/");
  await you(page).click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("night");
  expect(await page.evaluate(() => localStorage.getItem("gs-theme"))).toBe("night");
  await page.getByRole("button", { name: /By the clock/ }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("day");
  expect(await page.evaluate(() => localStorage.getItem("gs-theme"))).toBeNull();
});

test("S4 with an order open, You shows a strip that opens the tracker", async ({ page, context }) => {
  await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Back to the menu" }).click();   // an open order lands on its tracker first
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
  await context.addInitScript(() => { const clear = Storage.prototype.clear; Storage.prototype.clear = function () { sessionStorage.setItem("__cleared", "1"); return clear.call(this); }; });   // the test seeds the pin on every load, so watch the wipe itself
  await setup(context, page);
  await page.goto("/customer/");
  await you(page).click();
  await page.getByRole("button", { name: "Forget me on this phone" }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBe("110016");
  await page.getByRole("button", { name: "Forget me on this phone" }).click();
  await page.getByRole("button", { name: "Yes, forget" }).click();
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("__cleared")).catch(() => null)).toBe("1");
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
    await page.getByRole("button", { name: "Back to the menu" }).click();
    await you(page).click();
    await expect(page.getByRole("heading", { name: "You", exact: true })).toBeVisible();
    const scan = async () => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(await scan()).toEqual([]);
    await page.getByRole("button", { name: "My orders" }).click();
    await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
    expect(await scan()).toEqual([]);
  });
}
