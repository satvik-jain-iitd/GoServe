// Story B2 (#158): the customer app asks for a pin code, finds the kitchen that serves it and shows that kitchen's menu.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 a first visit asks for the pin code, then shows the menu of the kitchen that serves it", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Where do we deliver?" })).toBeVisible();
  await page.getByLabel("Your pin code").fill("110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("heading", { name: "Hauz Khas Kitchen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(net.calls.menuReads.some((u) => u.includes("kitchen_id=eq.k-1"))).toBe(true);
  expect(await page.evaluate(() => window.localStorage.getItem("gs-pin"))).toBe("110016");
});

test("S2 a pin code that no kitchen serves says so and is remembered", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByLabel("Your pin code").fill("110099");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Not in 110099 yet. We saved your pin. We will tell you when we come.")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("gs-pin"))).toBe("110099");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toHaveCount(0);
});

test("S3 a pin code that is not six digits is refused before anything is asked", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByLabel("Your pin code").fill("1100");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("alert")).toContainText("six digits");
  expect(net.calls.menuReads.filter((u) => u.includes("kitchen_id"))).toHaveLength(0);
});

test("S4 a kitchen that serves the pin code but is closed says it is closed", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.kitchens = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, lat: null, lng: null, opens_at: "10:00:00" }];
  await page.goto("/customer/");
  await page.getByLabel("Your pin code").fill("110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Closed now. Opens at 10:00 am. You can look at the menu.")).toBeVisible();
});

test("S5 a known pin code goes straight to the menu, and Change area goes back to the question", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Hauz Khas Kitchen" })).toBeVisible();
  await page.getByRole("button", { name: "Change area" }).click();
  await expect(page.getByRole("heading", { name: "Where do we deliver?" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("gs-pin"))).toBeNull();
});

test("S6 the demo console at / still shows the menu with no pin code question", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where do we deliver?" })).toHaveCount(0);
});

test("S7 a synthetic kitchen of the simulator is never shown to a real pin code (story #188)", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.kitchens = [{ id: "s-1", name: "Saket Rasoi", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, synthetic: true }];
  await page.goto("/customer/");
  await page.getByLabel("Your pin code").fill("110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Not in 110016 yet. We saved your pin. We will tell you when we come.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saket Rasoi" })).toHaveCount(0);
});
