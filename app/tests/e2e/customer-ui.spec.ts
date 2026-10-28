// Story D2 (#161): the customer app on the design system. Supabase and n8n are answered by the test (see helpers.ts).
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const MENU = [
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Main" },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Main" },
  { id: "d3", name: "Gulab Jamun", price_paise: 9000, image_url: null, image_credit: null, veg: true, category: "Sweet" },
];

test("S1 the menu shows the kitchen with its closing time, sections, a veg toggle and a search box in the Filter sheet", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: /Hauz Khas Kitchen/ })).toBeVisible();
  await expect(page.getByText("Open till 11:59 pm")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sweet" })).toBeVisible();
  await page.getByRole("button", { name: "Veg only" }).click();
  await expect(page.getByText("Butter Chicken")).toHaveCount(0);
  await expect(page.getByText("Dal Makhani")).toBeVisible();
  await page.getByRole("button", { name: "Veg only" }).click();
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByLabel("Search dishes").fill("butter");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(page.getByText("Dal Makhani")).toHaveCount(0);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByLabel("Search dishes").fill("zzz");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText("Nothing matches")).toBeVisible();
});

test("S2 the sticky cart bar shows the count and the total, and opens the cart", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add Dal Makhani" }).click();
  await page.getByRole("button", { name: "Add Gulab Jamun" }).click();
  await expect(page.getByRole("button", { name: /View bill \(2\)/ })).toContainText("₹310");
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
});

test("S3 the tracker has a timeline, an estimate and the short order number", async ({ page, context }) => {
  await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Order progress" }).locator('[aria-current="step"]')).toHaveText("Cooking");
  await expect(page.getByText("About 20 min")).toBeVisible();
  await expect(page.getByText(`No. ${ID.slice(0, 8)}`).first()).toBeVisible();   // the short order number is on the slip
  await expect(page.locator("body")).not.toContainText(ID);   // never the whole id
});

test("S4 once a rider has the order, the card shows the name and a call link", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  await page.goto("/customer/");
  await expect(page.getByTestId("rider-card")).toContainText("Ravi");
  await expect(page.getByRole("link", { name: "Call Ravi" })).toHaveAttribute("href", "tel:9876500000");
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "order_rider").length).toBeGreaterThan(0);
  expect(net.calls.rpc.find((c) => c.name === "order_rider")!.body).toEqual({ p_order: ID });
});

test("S4 with no rider yet there is no rider card", async ({ page, context }) => {
  await setup(context, page, [order("ready", "2020-01-01T10:04:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
  await expect(page.getByTestId("rider-card")).toHaveCount(0);
});

test("S5 My orders: See the menu opens the menu with an empty cart", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", "2020-01-01T11:00:00Z"), paid_by: "cash" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "My orders" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();   // the slip opens as the delivered screen
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Place order|View cart|Your bill/ })).toHaveCount(0);   // an empty cart shows no cart bar
});

test("S5 an empty My orders says so and points back to the menu", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "My orders" }).click();
  await expect(page.getByText("No orders yet")).toBeVisible();
});

test("S6 Account shows the saved name, phone and address, and signs out", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.customer = { user_id: "u", name: "Asha", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "You", exact: true })).toBeVisible();
  await expect(page.getByTestId("account")).toContainText("Asha");
  await expect(page.getByTestId("account")).toContainText("9876543210");
  await expect(page.getByTestId("account")).toContainText("Flat 4, Green Park");
});

test("S7 the bill says cash at the door in plain words", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4");
  await expect(page.getByText("Pay the rider cash at the door.")).toHaveCount(0);   // story #659: the slip and the bar say cash
});

// Story #653 (row T3): the rider card is the same light box; its text is ink in Day and Night.
for (const theme of ["day", "night"]) {
  test(`S-653 ${theme}: the rider card text is ink on the box`, async ({ page, context }) => {
    await context.addInitScript((t) => { try { localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
    const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
    net.state.riderCard = { name: "Ravi", phone: "9876500000" };
    await page.goto("/customer/");
    await expect(page.getByTestId("rider-card")).toContainText("Ravi");
    expect(await page.getByTestId("rider-card").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(38, 53, 40)");
  });
}
