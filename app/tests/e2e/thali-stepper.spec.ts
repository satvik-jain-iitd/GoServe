// Story #608 (row T2 of the #325 sitting): the thali card uses the same stepper as every other dish: Add, then Less, the number and More. No "Added n" button. Minus at 1 takes it out.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const MENU = [
  { id: "t1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali" },
  { id: "t2", name: "Non-veg Thali", price_paise: 24000, image_url: null, image_credit: null, veg: false, category: "Thali" },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Main" },
];

for (const theme of ["day", "night"]) {
  test(`S1 ${theme}: Add turns into Less, 1 and More; minus at 1 takes the thali out; plus and the bar follow`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.menu = MENU;
    await page.addInitScript((t) => { try { window.localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
    await page.goto("/customer/");
    const hero = page.getByRole("region", { name: "Today's thali" });
    await hero.getByRole("button", { name: "Add Veg Thali" }).click();
    await expect(hero.getByRole("status", { name: "Quantity of Veg Thali" })).toHaveText("1");
    await expect(hero.getByRole("button", { name: "Less Veg Thali" })).toBeVisible();
    await expect(hero.getByText(/^Added/)).toHaveCount(0);
    await hero.getByRole("button", { name: "More Veg Thali" }).click();
    await hero.getByRole("button", { name: "More Veg Thali" }).click();
    await expect(hero.getByRole("status", { name: "Quantity of Veg Thali" })).toHaveText("3");
    await expect(page.getByRole("button", { name: /View bill \(3\)/ })).toContainText("₹540");
    await hero.getByRole("button", { name: "Less Veg Thali" }).click();
    await expect(hero.getByRole("status", { name: "Quantity of Veg Thali" })).toHaveText("2");
    await hero.getByRole("button", { name: "Less Veg Thali" }).click();
    await hero.getByRole("button", { name: "Less Veg Thali" }).click();
    await expect(hero.getByRole("button", { name: "Add Veg Thali" })).toBeVisible();
    await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  });
}

test("S2 the thali stepper is the same component as a dish's: same classes, same labels", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Dal Makhani" }).click();
  await page.getByRole("region", { name: "Today's thali" }).getByRole("button", { name: "Add Non-veg Thali" }).click();
  const classes = (name: string) => page.getByRole("status", { name: `Quantity of ${name}` }).locator("xpath=..").getAttribute("class");
  expect(await classes("Non-veg Thali")).toBe(await classes("Dal Makhani"));
});
