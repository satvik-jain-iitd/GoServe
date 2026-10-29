// Story B2 (#158): the customer app asks for a pin code, finds the kitchen that serves it and shows that kitchen's menu.
import { test, expect } from "@playwright/test";
import { setup, typePlace } from "./helpers";

test("S1 a first visit asks for the pin code, then shows the menu of the kitchen that serves it", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  await typePlace(page, "110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hauz Khas Kitchen" })).toHaveCount(0);   // story #668: the kitchen is not named on the menu
  expect(net.calls.menuReads.some((u) => u.includes("kitchen_id=eq.k-1"))).toBe(true);
  expect(await page.evaluate(() => window.localStorage.getItem("gs-pin"))).toBe("110016");
});

test("S2 a pin code that no kitchen serves says so and is remembered", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await typePlace(page, "110099");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Not here yet. We do not deliver to 110099 yet.")).toBeVisible();
  await expect(page.getByText(/We will tell you|We add pin codes every week/)).toHaveCount(0);   // no waitlist exists yet, so no promise (M.3, #322)
  expect(await page.evaluate(() => window.localStorage.getItem("gs-pin"))).toBe("110099");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toHaveCount(0);
});

test("S3 a pin code that is not six digits keeps See the menu off, and nothing is asked", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await typePlace(page, "1100");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeDisabled();   // story #668: the button waits for an address and six digits
  expect(net.calls.menuReads.filter((u) => u.includes("kitchen_id"))).toHaveLength(0);
});

test("S4 a kitchen that serves the pin code but is closed says it is closed", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.kitchens = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, lat: null, lng: null, opens_at: "10:00:00" }];
  await page.goto("/customer/");
  await typePlace(page, "110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Kitchen closed. Opens at 10:00 am.")).toBeVisible();
});

test("S5 a known pin code goes straight to the menu, and Change area goes back to the question", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await page.getByRole("button", { name: "Change area" }).click();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("gs-pin"))).toBeNull();
});

test("S6 the demo console at / still shows the menu with no pin code question", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toHaveCount(0);
});

test("S7 a demo kitchen is shown on its real pin code (story #283)", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.kitchens = [{ id: "s-1", name: "Saket Rasoi", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, synthetic: true }];
  await page.goto("/customer/");
  await typePlace(page, "110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the demo kitchen's menu opens; its name is back-end (story #668)
  await expect(page.getByText("Not in 110016 yet")).toHaveCount(0);
});
