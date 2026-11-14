// Story 1476 (owner's design rule 8, as #1457): on the Add dish form the main button is last. "Not now" (outline) sits above "Add dish" (filled),
// and when the form opens both buttons are fully in view (the kitchen page has no tab bar).
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { setup } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

async function open(page: Page, context: BrowserContext) {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.menu = Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, name: `Dish ${i}`, price_paise: 20000, image_url: null, image_credit: null }));   // a real menu: the form opens below the fold
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await expect(page.getByLabel("Dish name")).toBeVisible();
}

test("S1 Given the Add dish form is open, then Add dish is the last button and Not now is right above it", async ({ page, context }) => {
  await open(page, context);
  expect(await page.locator(".ui-form-acts .ui-btn").allTextContents()).toEqual(["Not now", "Add dish"]);
  const [no, add] = [await page.getByRole("button", { name: "Not now" }).boundingBox(), await page.getByRole("button", { name: "Add dish" }).boundingBox()];
  expect(no!.y + no!.height).toBeLessThanOrEqual(add!.y);
});

test("S2 Given the form is open on a phone 390 x 844, then both buttons are fully on the screen", async ({ page, context }) => {
  await open(page, context);
  await page.waitForTimeout(600);   // the scroll into view settles
  for (const name of ["Not now", "Add dish"]) {
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, `${name} is on the screen`).toBeLessThanOrEqual(844);
  }
});
