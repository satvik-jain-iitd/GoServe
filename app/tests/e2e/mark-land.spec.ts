// Story #525: the pin mark in the Menu header flies in once, right after the pin screen. Switching tabs back to the Menu never replays it.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const mark = (page: import("@playwright/test").Page) => page.locator(".ui-pin-svg");

test("S1 right after the pin screen the mark flies once into the header", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByLabel("Your pin code").fill("110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).toHaveClass(/ui-mark-land/);
});

test("S2 coming back to the Menu from Orders or You, the mark is already in place and nothing moves", async ({ page, context }) => {
  await setup(context, page, [], { pin: "110016" });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).not.toHaveClass(/ui-mark-land/);   // a saved pin is not a fresh pick
  for (const tab of ["My orders", "Account"]) {
    await page.getByRole("button", { name: tab }).click();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
    await expect(mark(page)).not.toHaveClass(/ui-mark-land/);
  }
});

test("S2 after the first fly-in a tab switch does not replay it", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByLabel("Your pin code").fill("110016");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(mark(page)).toHaveClass(/ui-mark-land/);
  await page.getByRole("button", { name: "My orders" }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).not.toHaveClass(/ui-mark-land/);
});
