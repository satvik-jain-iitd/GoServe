// Story #1161 (QA screen 19, design rule 8): in the dish sheet the outline Close sits above and the filled "Add to bill" is LAST, at the bottom. The stepper buttons are 44 px or more wide (Apple HIG).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 Close is above Add to bill, and the stepper buttons are 44 px wide or more", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Butter Chicken details" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Butter Chicken" });
  const [close, add] = [(await sheet.getByRole("button", { name: "Close" }).boundingBox())!, (await sheet.getByRole("button", { name: /Add to bill/ }).boundingBox())!];
  expect(add.y).toBeGreaterThan(close.y);   // Add is last
  expect(add.y).toBeGreaterThan(close.y + close.height - 1);   // under it, not beside it
  for (const name of [/Less|Remove|−|decrease/i, /More|Add one|\+|increase/i]) {
    const b = sheet.getByRole("button", { name }).first();
    if (await b.count()) expect((await b.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  }
  const steps = await sheet.locator(".ui-step button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(steps.length).toBe(2);
  for (const w of steps) expect(w).toBeGreaterThanOrEqual(44);
});
