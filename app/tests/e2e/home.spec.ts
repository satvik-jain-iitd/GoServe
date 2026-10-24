// Story H10b (#193): the Ink v3 pin screen, menu, thali hero, Filter sheet, Dish sheet and the closed and loading states (boards 01, 01e, 02, 02a, 02b, 02c, 03).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./helpers";

const MENU = [
  { id: "t1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali" },
  { id: "t2", name: "Non-veg Thali", price_paise: 24000, image_url: null, image_credit: null, veg: false, category: "Thali" },
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null, veg: false, category: "Main" },
  { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Main" },
  { id: "d3", name: "Gulab Jamun", price_paise: 9000, image_url: null, image_credit: null, veg: true, category: "Sweet" },
];

test("S1 the hero shows the veg and non-veg thali, the sections hold the other dishes, and Add turns into a stepper", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  const hero = page.getByRole("region", { name: "Today's thali" });
  await expect(hero.getByRole("button", { name: "Add Veg Thali" })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Non-veg thali" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Main" })).toBeVisible();
  await page.getByRole("button", { name: "Add Dal Makhani" }).click();
  await expect(page.getByRole("button", { name: "Add Dal Makhani" })).toHaveCount(0);
  await page.getByRole("button", { name: "More Dal Makhani" }).click();
  await expect(page.getByRole("button", { name: /View cart \(2\)/ })).toContainText("₹440");
  await page.getByRole("button", { name: "Less Dal Makhani" }).click();
  await page.getByRole("button", { name: "Less Dal Makhani" }).click();
  await expect(page.getByRole("button", { name: /View cart/ })).toHaveCount(0);
});

test("S2 a menu with no thali has no hero", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU.slice(2);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Today's thali" })).toHaveCount(0);
});

test("S3 tapping a dish photo opens the Dish sheet; Add to bill puts the chosen number in the cart", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Butter Chicken details" }).click();
  const sheet = page.getByRole("dialog", { name: "Butter Chicken" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "More Butter Chicken" }).click();
  await expect(sheet.getByRole("button", { name: /Add to bill · ₹640/ })).toBeVisible();
  await sheet.getByRole("button", { name: /Add to bill/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: /View cart \(2\)/ })).toContainText("₹640");
});

test("S4 the Filter sheet jumps to a section and closes", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Filter" }).click();
  const sheet = page.getByRole("dialog", { name: "Filter" });
  await expect(sheet.getByText("5 dishes")).toBeVisible();
  await sheet.getByRole("button", { name: /Sweet/ }).click();
  await expect(sheet).toHaveCount(0);
});

test("S5 a closed kitchen shows its menu with Add switched off and says when it opens", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.menu = MENU;
  net.state.kitchens = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, lat: null, lng: null, opens_at: "10:00:00" }];
  await page.goto("/customer/");
  await page.getByLabel("Pin code").fill("110016");
  await page.getByRole("button", { name: "Show kitchen" }).click();
  await expect(page.getByText("Hauz Khas Kitchen is closed right now. It opens at 10:00 am.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeDisabled();
});

test("S6 while the menu loads the page says it is busy; the saved pin is on the pin chip", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/menu_items*", async (route) => { await gate; await route.fallback(); });
  await page.goto("/customer/");
  await expect(page.getByLabel("Loading the menu")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("button", { name: /Change area, pin code/ })).toBeVisible();
  release();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S7 a pin code that no kitchen serves marks the field and keeps the button", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByLabel("Pin code").fill("110099");
  await page.getByRole("button", { name: "Show kitchen" }).click();
  await expect(page.getByLabel("Pin code")).toHaveAttribute("aria-invalid", "true");
});

for (const t of ["day", "night"] as const) {
  test(`S8 the menu with a thali has no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    const net = await setup(context, page);
    net.state.menu = MENU;
    await page.goto("/customer/");
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
    const bad = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
