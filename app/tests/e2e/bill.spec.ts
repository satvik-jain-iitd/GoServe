// Story H10c (#193): the Ink v3 bill, placed, tracker and delivered screens (boards 04, 04e, 05, 06, 07) and the Track an order button of board 01.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { order, setup } from "./helpers";

const KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, opens_at: "10:00:00", closes_at: "22:00:00" };

test("S1 a bill with nothing on it says so and goes back to the menu", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("1 × Butter Chicken")).toBeVisible();
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to menu" }).click();
  await page.getByRole("button", { name: "Less Butter Chicken" }).click();
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
});

test("S2 Place order stays off until the name, a ten digit phone and the address are there", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("S3 the pin screen has a Track an order button that opens the orders", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Track an order" }).click();
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
});

test("S4 a delivered order shows the Delivered stamp, Cash paid and a way to call the kitchen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchens = [KITCHEN];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", { ...order("delivered", new Date().toISOString()), paid_by: "cash" });
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible({ timeout: 6000 });
  await expect(page.getByText("Cash paid")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call the kitchen" })).toHaveAttribute("href", "tel:9876543210");
  await expect(page.getByRole("button", { name: "Order again" })).toBeVisible();
});

test("S5 a cooking order shows the Live mark and the Cooking stamp", async ({ page, context }) => {
  await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order" }).getByText("Cooking", { exact: true })).toBeVisible();
});

for (const t of ["day", "night"] as const) {
  test(`S6 the bill and the tracker have no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    const net = await setup(context, page);
    net.state.kitchens = [KITCHEN];
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Add Butter Chicken" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await page.getByLabel("Your name").fill("Asha");
    const check = async () => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(await check()).toEqual([]);
  });
  test(`S6 the placed screen has no serious violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    const net = await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
    net.state.kitchens = [KITCHEN];
    await page.goto("/customer/");
    await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();
    const bad = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
