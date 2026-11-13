// Story 1401 (board Dish): the price in the customer dish sheet is --gs-mono-lg (22 px). The kitchen menu rows keep 13 px under their own class name,
// so one rule cannot change the other again.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the price in the dish sheet is 22 px, the token --gs-mono-lg", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Butter Chicken details" }).click();
  const price = page.getByRole("dialog", { name: "Butter Chicken" }).locator(".ui-dish-head span").last();
  await expect(price).toBeVisible();
  const want = await page.evaluate(() => {
    const p = document.createElement("span");
    p.style.fontSize = "var(--gs-mono-lg)";
    document.body.appendChild(p);
    return getComputedStyle(p).fontSize;
  });
  expect(want).toBe("22px");
  await expect(price).toHaveCSS("font-size", want);
});
