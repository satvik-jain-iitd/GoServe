// Story #975, board C1-HomeTop: the top of the home screen is the address, the profile circle, search and the VEG switch; two tabs, Delivery and History.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const dish = (id: string, name: string, category: string, veg: boolean) => ({ id, name, price_paise: 10000, category, veg, available: true, image_url: null, image_credit: null });
const MENU = [dish("d1", "Dal Makhani", "Mains", true), dish("d2", "Butter Chicken", "Mains", false), dish("d3", "Veg Thali", "Thali", true), dish("d4", "Chicken Thali", "Thali", false)];
const ADDRESS = "C-128, Green Avenue Colony, Satai Road, Chhatarpur 471001";

const home = async (page: Page, context: Parameters<typeof setup>[0], avatar: string | null = null) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  net.state.avatar = avatar;
  await page.addInitScript((a) => { try { localStorage.setItem("gs-draft", JSON.stringify({ step: "menu", cart: {}, address: a, name: "Amit Kumar", phone: "9812345678" })); } catch { /* none */ } }, ADDRESS);
  await page.goto("/customer/");
  return net;
};

test("S1 the top shows the label and the address, the circle, search and the VEG switch; the bar has two tabs", async ({ page, context }) => {
  await home(page, context);
  const where = page.getByRole("button", { name: /^Home\b/ });
  await expect(where).toContainText("Home");
  await expect(where).toContainText(ADDRESS);
  await expect(page.getByRole("button", { name: /^You: / })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Veg only, whole menu" })).toBeVisible();
  const bar = page.getByRole("navigation", { name: "Main" });
  await expect(bar.getByRole("button")).toHaveCount(2);
  await expect(bar.getByRole("button", { name: "Delivery" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "History" })).toBeVisible();
  await expect(page.getByRole("button", { name: "You (Account)" })).toHaveCount(0);
});

test("S2 no greeting sentence; the Open till line stays", async ({ page, context }) => {
  await home(page, context);
  await expect(page.getByText(/^Good (morning|afternoon|evening|night)/)).toHaveCount(0);
  await expect(page.locator(".ui-zigzag")).toBeVisible();
});

test("S3 tapping the address opens today's area screen", async ({ page, context }) => {
  await home(page, context);
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toHaveCount(0);
  await expect(page.getByLabel("Pin code").or(page.getByRole("group", { name: "Your address" }))).toBeVisible();
});

test("S4 tapping the circle opens the profile; no You tab exists", async ({ page, context }) => {
  await home(page, context);
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByRole("region", { name: "Delivery details" })).toContainText("Amit Kumar");
  await expect(page.getByRole("button", { name: "You (Account)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
});

test("S5 VEG on hides non-veg dishes and the non-veg thali; the filter sheet shows Veg only on", async ({ page, context }) => {
  await home(page, context);
  await page.getByRole("switch", { name: "Veg only, whole menu" }).check();
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Non-veg thali" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toBeVisible();
  await page.getByRole("button", { name: "Filter the menu" }).click();
  await expect(page.getByRole("dialog", { name: "Filter" }).getByRole("switch", { name: /Veg only/ })).toBeChecked();
});

test("S6 typing in the search field filters the menu", async ({ page, context }) => {
  await home(page, context);
  await page.getByRole("searchbox", { name: "Search dishes" }).fill("butter");
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toHaveCount(0);
});

test("S7 the circle shows the Google photo when the account has one, else the first letter", async ({ page, context }) => {
  await home(page, context, "https://example.com/amit.png");
  await expect(page.getByRole("button", { name: /^You: / }).locator("img")).toHaveAttribute("src", "https://example.com/amit.png");
});

test("S8 with no photo the circle shows the first letter of the name", async ({ page, context }) => {
  await home(page, context);
  await expect(page.getByRole("button", { name: /^You: / })).toHaveText("A");
});

test("S9 a photo that cannot load leaves the first letter in the circle", async ({ page, context }) => {
  await context.route("https://example.com/**", (r) => r.abort());
  await home(page, context, "https://example.com/gone.png");
  await expect(page.getByRole("button", { name: /^You: / })).toHaveText("A");
  await expect(page.getByRole("button", { name: /^You: / }).locator("img")).toHaveCount(0);
});
