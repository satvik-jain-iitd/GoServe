// Story D1 (#160): /styleguide lists every component. The build for tests sets VITE_STYLEGUIDE=1; a release build does not.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S4 the styleguide shows all ten components", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { name: "Styleguide" })).toBeVisible();
  for (const name of ["AppBar", "Tile", "Chip", "Stepper", "StickyBar", "Timeline", "Sheet", "Button", "Empty", "Skeleton"]) {
    await expect(page.getByTestId(`sg-${name}`)).toBeVisible();
  }
});

test("S3 buttons, chips and steppers are at least 44 px tall on the styleguide", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/styleguide");
  for (const sel of [".ui-btn", ".ui-chip", ".ui-step button", ".ui-back"]) {
    for (const el of await page.locator(sel).all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Roboto");
});

test("S4 the Sheet opens and closes, the Stepper counts", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/styleguide");
  await page.getByRole("button", { name: "More Demo dish" }).click();
  await expect(page.locator(".ui-step span")).toHaveText("2");
  await page.getByRole("button", { name: "Open sheet" }).click();
  await expect(page.getByRole("dialog", { name: "Demo sheet" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
