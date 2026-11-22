// Story 1766 (layer A, test-infra): setup() answers POST /quote by itself, so a spec that mocks no quote still gets a price on the Bill.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("D1 the Bill gets a total from the shared default quote, no spec mock", async ({ page, context }) => {
  const answered = page.waitForResponse((r) => r.url().endsWith("/functions/v1/quote") && r.request().method() === "POST", { timeout: 5000 });
  await setup(context, page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByTestId("bill-total")).toHaveText("₹320");
  expect((await answered).status()).toBe(200);   // the quote is answered by setup(), not by the network
});
