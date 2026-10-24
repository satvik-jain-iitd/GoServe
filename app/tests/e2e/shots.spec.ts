// Fit-check screenshots for the PR (stories H10b to H10d): SHOTS=docs/mvp25/h10b-shots npx playwright test shots. Skipped in normal runs.
import { test } from "@playwright/test";
import { order, setup } from "./helpers";

const OUT = process.env.SHOTS;
const MENU = [
  { id: "t1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali" },
  { id: "t2", name: "Non-veg Thali", price_paise: 24000, image_url: null, image_credit: null, veg: false, category: "Thali" },
  { id: "d1", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Mains" },
  { id: "d2", name: "Paneer Butter Masala", price_paise: 26000, image_url: null, image_credit: null, veg: true, category: "Mains" },
  { id: "d3", name: "Chicken Curry", price_paise: 28000, image_url: null, image_credit: null, veg: false, category: "Mains" },
  { id: "d4", name: "Tandoori Roti", price_paise: 2000, image_url: null, image_credit: null, veg: true, category: "Breads" },
];
test.use({ viewport: { width: 390, height: 844 } });
test.skip(!OUT, "set SHOTS to a folder to take the screenshots");

for (const theme of ["day", "night"] as const) {
  test(`shots ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const net = await setup(context, page, [], { pin: null });
    net.state.menu = MENU;
    await page.goto("/customer/");
    await page.getByRole("heading", { name: "Where do we deliver?" }).waitFor();
    await page.waitForTimeout(600);
    await shot("Main");
    await page.getByLabel("Your pin code").fill("110099");
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByText("We are not in 110099").waitFor();
    await shot("S-NoKitchen");
    await page.getByLabel("Your pin code").fill("110016");
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByRole("button", { name: "Add Dal Makhani" }).waitFor();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Add Dal Makhani" }).click();
    await page.getByRole("button", { name: "More Dal Makhani" }).click();
    await shot("Menu");
    await page.getByRole("button", { name: "Filter" }).click();
    await shot("Categories");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Chicken Curry details" }).click();
    await shot("Dish");
    await page.getByRole("button", { name: "Close", exact: true }).click();
  });
}

for (const theme of ["day", "night"] as const) {
  test(`shots states ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page, [], { pin: null });
    net.state.menu = MENU;
    net.state.kitchens = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, lat: null, lng: null, opens_at: "11:00:00" }];
    await page.goto("/customer/");
    await page.getByLabel("Your pin code").fill("110016");
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByRole("button", { name: "Add Dal Makhani" }).waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${theme}/S-Closed-${theme}.png` });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/rest/v1/menu_items*", async (route) => { await gate; await route.fallback(); });
    await page.evaluate(() => localStorage.removeItem("gs.menu.v1.k-1"));
    await page.reload();
    await page.getByLabel("Loading the menu").waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${theme}/S-Loading-${theme}.png` });
    release();
  });
}

const KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, opens_at: "10:00:00", closes_at: "22:00:00" };
for (const theme of ["day", "night"] as const) {
  test(`shots bill and tracker ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const net = await setup(context, page);
    net.state.menu = MENU;
    net.state.kitchens = [KITCHEN];
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Add Dal Makhani" }).click();
    await page.getByRole("button", { name: "Add Tandoori Roti" }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "More Tandoori Roti" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await page.getByLabel("Your name").fill("Rahul Verma");
    await page.getByLabel("Phone").fill("9876543210");
    await page.getByLabel("Address").fill("B-12, Lajpat Nagar II, near the park gate");
    await shot("Bill");
    await page.getByRole("button", { name: /Place order/ }).click();
    await page.getByRole("heading", { name: "Order placed" }).waitFor();
    await shot("Placed");
    net.push("UPDATE", order("preparing", new Date().toISOString()));
    await page.getByText("Live", { exact: true }).waitFor();
    await shot("Tracker");
    net.push("UPDATE", { ...order("delivered", new Date().toISOString()), paid_by: "cash" });
    await page.getByRole("heading", { name: "Delivered", exact: true }).waitFor();
    await shot("Delivered");
  });
  test(`shots empty bill ${theme}`, async ({ page, context }) => {
    await context.addInitScript(([v]) => { localStorage.setItem("gs-theme", v); localStorage.setItem("gs-draft", JSON.stringify({ step: "bill", cart: {}, address: "", name: "", phone: "" })); }, [theme]);
    const net = await setup(context, page);
    net.state.menu = MENU;
    await page.goto("/customer/");
    await page.getByRole("heading", { name: "Nothing on it yet" }).waitFor();
    await page.screenshot({ path: `${OUT}/${theme}/S-EmptyBill-${theme}.png` });
  });
}
