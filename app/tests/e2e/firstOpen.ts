// Story #1049 (boards A1, A1p, C7): the first-open path to the menu, as a test helper. Use my location opens the pin map at the phone; Confirm & proceed opens the details sheet;
// Save address stores the place with the pin's lat and lng and opens the menu.
import { expect, type Page } from "@playwright/test";

export async function firstOpenToMenu(page: Page, house = "B-12, ground floor") {
  await page.getByRole("button", { name: "Set delivery location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm & proceed" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.getByLabel("House, flat, floor").fill(house);
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
}
