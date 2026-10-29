// Story #619 layer a (boards L1 closed, L2 sold out): the menu follows the kitchen live. The kitchen's switch and a dish's availability reach the phone
// within seconds, with no reload. The test realtime socket pushes the change; the REST answers are changed first, as the real database would.
import { test, expect, type Page } from "@playwright/test";
import { scan, setup } from "./helpers";

const DISHES = [
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, available: true },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, available: true },
];
const add = (page: Page, name: string) => page.getByRole("button", { name: `Add ${name}` });

test("S1 the kitchen's hours change to after now: within 5 s the phone says closed, with the reopen time, and Add is off; it recovers when the hours come back", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.clock.setFixedTime(new Date("2026-10-24T06:30:00Z"));   // 12:00 India
  await page.goto("/customer/");
  await expect(add(page, "Butter Chicken")).toBeEnabled();
  Object.assign(net.state.kitchens[0], { opens_at: "18:00:00", closes_at: "22:00:00" });
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(page.getByText("Kitchen closed. Opens at 6:00 pm.")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Your bill is kept. Order from 6:00 pm.")).toBeVisible();
  await expect(add(page, "Butter Chicken")).toBeDisabled();
  Object.assign(net.state.kitchens[0], { opens_at: "00:00:00", closes_at: "23:59:00" });
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(page.getByText("Kitchen closed. Opens at 6:00 pm.")).toHaveCount(0, { timeout: 5000 });
  await expect(add(page, "Butter Chicken")).toBeEnabled();
});

test("S2 the closed state has no live stepper or Add, and the bill is kept", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await add(page, "Butter Chicken").click();
  await expect(page.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("1");
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  net.push("UPDATE", net.state.kitchens[0], "kitchens");
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "More Butter Chicken" })).toHaveCount(0);
  await expect(add(page, "Butter Chicken")).toBeDisabled();
  await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();   // the bill is kept
});

test("S3 a dish sold out: within 5 s its card says Sold out and cannot be added; it recovers when the dish is back", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  await page.goto("/customer/");
  await expect(add(page, "Dal Makhani")).toBeEnabled();
  net.state.menu = [DISHES[0], { ...DISHES[1], available: false }];
  net.push("UPDATE", net.state.menu[1], "menu_items");
  const card = page.locator("article").filter({ hasText: "Dal Makhani" });
  await expect(card.getByText("Sold out", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(add(page, "Dal Makhani")).toHaveCount(0);
  await expect(add(page, "Butter Chicken")).toBeEnabled();
  net.state.menu = DISHES;
  net.push("UPDATE", DISHES[1], "menu_items");
  await expect(add(page, "Dal Makhani")).toBeEnabled({ timeout: 5000 });
});

test("S4 the closed and sold-out screens have no serious contrast or role violation, Day and Night", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [DISHES[0], { ...DISHES[1], available: false }];
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  for (const theme of ["day", "night"]) {
    await context.addInitScript((t) => { try { localStorage.setItem("gs-theme", t); } catch { /* blocked */ } }, theme);
    await page.goto("/customer/");
    await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible();
    expect(await scan(page)).toEqual([]);
  }
});
