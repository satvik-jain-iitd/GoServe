// Story 1457 (board AP1): on the Add a person form the main button is last. "Not now" (outline) sits above "Add person" (filled),
// and when the form opens both buttons are fully in view, clear of the tab bar.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("S1 Given the Add a person form is open, then Add person is the last button and Not now is right above it", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "Add a person" }).click();
  const names = await page.locator(".ui-form-acts .ui-btn").allTextContents();
  expect(names).toEqual(["Not now", "Add person"]);
  const [no, add] = [await page.getByRole("button", { name: "Not now" }).boundingBox(), await page.getByRole("button", { name: "Add person" }).boundingBox()];
  expect(no!.y + no!.height).toBeLessThanOrEqual(add!.y);
});

test("S2 Given the form is open on a phone 390 x 844, then no part of either button is under the tab bar", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = Array.from({ length: 12 }, (_, i) => ({ kind: "rider", user_id: `r-${i}`, email: `rider${i}@example.com`, kitchen_id: null, kitchen_name: null }));   // a real city: the form opens below the fold
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.waitForTimeout(600);   // the scroll into view settles
  const bar = (await page.locator(".ui-tabs").boundingBox())!;
  for (const name of ["Not now", "Add person"]) {
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, `${name} is clear of the tab bar`).toBeLessThanOrEqual(bar.y);
  }
});
