// Story #525: the pin mark in the Menu header flies in once, right after the pin screen. Switching tabs back to the Menu never replays it.
import { test, expect } from "@playwright/test";
import { setup, typePlace } from "./helpers";

const mark = (page: import("@playwright/test").Page) => page.locator(".ui-pin-svg");

test("S1 right after the pin screen the mark flies once into the header", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await typePlace(page, "110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).toHaveClass(/ui-mark-land/);
});

test("S2 coming back to the Menu from History or the profile, the mark is already in place and nothing moves", async ({ page, context }) => {
  await setup(context, page, [], { pin: "110016" });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).not.toHaveClass(/ui-mark-land/);   // a saved pin is not a fresh pick
  for (const [open, back] of [["History", "Delivery"], ["You: your details, alerts and account", "Back"]]) {
    await page.getByRole("button", { name: open }).click();
    await page.getByRole("button", { name: back, exact: true }).click();
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
    await expect(mark(page)).not.toHaveClass(/ui-mark-land/);
  }
});

test("S2 after the first fly-in a tab switch does not replay it", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await typePlace(page, "110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(mark(page)).toHaveClass(/ui-mark-land/);
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).not.toHaveClass(/ui-mark-land/);
});
