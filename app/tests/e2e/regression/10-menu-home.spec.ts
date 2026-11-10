// Regression, screen 10: C1 Menu home. Cases: .claude/handoff/qa/screens/10-C1.md (epic #1196). Reached with the shared step STEPS["menu"].
// Where the case needs data the shared step does not hold (a saved Home, a thali, a sold-out dish, a kitchen that closes), the test answers the same
// REST paths again after the step (a later route wins) and reloads the same page. The step is still the only way in.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { setup, typePlace } from "../helpers";
import { firstOpenToMenu } from "../firstOpen";

const PATH = "/customer/";
const ADDRESS = "C-128, Green Avenue Colony, Satai Road, Chhatarpur 471001";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const dish = (id: string, name: string, category: string, veg: boolean, extra: Record<string, unknown> = {}) =>
  ({ id, name, price_paise: 22000, image_url: null, image_credit: null, veg, category, available: true, ...extra });
// Mains and Starters, a veg and a non-veg thali (the hero), and one sold-out dish.
const MENU = [
  dish("d1", "Dal Makhani", "Mains", true),
  dish("d2", "Butter Chicken", "Mains", false, { price_paise: 32000 }),
  dish("d3", "Paneer Tikka", "Starters", true, { available: false }),
  dish("d4", "Veg Thali", "Thali", true, { price_paise: 19900 }),
  dish("d5", "Chicken Thali", "Thali", false, { price_paise: 24900 }),
];
const HOME = { id: "h1", label: "Home", address: ADDRESS, pin_code: "110016", lat: 24.9167, lng: 79.5833, last_used_at: "2026-11-08T10:00:00Z" };

const isPath = (path: string) => (url: URL) => url.pathname === path;
// Answers a REST read (and the browser's preflight); any write goes to the shared step's own answer.
async function answer(route: Route, body: unknown) {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  if (req.method() !== "GET") return route.fallback();
  return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}
// The shared step, then this menu's dishes, then the same page again so the app reads them.
async function menuWith(page: Page, context: BrowserContext, menu: object[]) {
  await STEPS["menu"](context, page, PATH);
  await context.route(isPath("/rest/v1/menu_items"), (r) => answer(r, menu));
  await page.reload();
}

test("TC 10.1 Look: the Home and its address on top, the circle, search with filter, Veg switch, Open till, today's thali, groups", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);
  await context.route(isPath("/rest/v1/menu_items"), (r) => answer(r, MENU));
  await context.route(isPath("/rest/v1/addresses"), (r) => answer(r, [HOME]));
  await typePlace(page, "110016", ADDRESS);   // the place the app keeps for the draft, then the page starts again
  await expect(page.getByRole("heading", { name: "Mains" })).toBeVisible();   // proves the menu shows before the top is checked
  const where = page.getByRole("button", { name: /^Home\b/ });
  await expect(where).toContainText(ADDRESS);
  await expect(page.getByRole("button", { name: /^You: / })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter the menu" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Veg only, whole menu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Open till \d{1,2}:\d{2} (am|pm)$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Today's thali" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mains" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Starters" })).toBeVisible();
});

test("TC 10.2 Load: the menu appears in one go, no rows popping in (#1134)", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await context.route(isPath("/rest/v1/menu_items"), async (route) => {
    if (route.request().method() === "GET") await gate;   // the menu waits until the test lets it through
    await answer(route, MENU);
  });
  await page.reload();
  await expect(page.getByLabel("Loading the menu")).toBeVisible();   // the screen shows its loading state while the data is out
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toHaveCount(0);
  // Records how many dish rows are on the screen the first time any row appears: all of them, in one go.
  await page.evaluate(() => {
    const w = window as unknown as { __firstRows: number | null };
    w.__firstRows = null;
    new MutationObserver(() => {
      if (w.__firstRows === null && document.querySelectorAll("article").length > 0) w.__firstRows = document.querySelectorAll("article").length;
    }).observe(document.body, { childList: true, subtree: true });
  });
  release();
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toBeVisible();
  await expect(page.getByLabel("Loading the menu")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Today's thali" })).toBeVisible();
  const first = await page.evaluate(() => (window as unknown as { __firstRows: number | null }).__firstRows);
  expect(first).toBe(3);   // Dal Makhani, Butter Chicken and Paneer Tikka: every row came in the same paint
});

test("TC 10.3 Tap Add on a dish: the stepper shows 1 and the View bill bar shows 1 item and the sum", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);
  const add = page.getByRole("button", { name: "Add Butter Chicken" });
  await expect(add).toBeVisible();
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);   // no bar before the tap
  await add.click();
  await expect(page.getByRole("status", { name: "Quantity of Butter Chicken" })).toHaveText("1");
  await expect(page.getByRole("button", { name: "View bill (1) · ₹320" })).toBeVisible();
  await expect(page.getByText("1 item · ₹320")).toBeVisible();
});

test("TC 10.4 Veg on: only veg dishes and the veg thali, the switch green with a white knob", async ({ page, context }) => {
  await menuWith(page, context, MENU);
  const veg = page.getByRole("switch", { name: "Veg only, whole menu" });
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // proves the non-veg rows show first
  await expect(page.getByRole("heading", { name: "Chicken Thali" })).toBeVisible();
  await veg.check();
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chicken Thali" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Veg Thali" })).toBeVisible();
  const paint = await veg.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, knob: getComputedStyle(el, "::before").backgroundColor }));
  const [r, g, b] = (paint.bg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  expect(g, `switch colour ${paint.bg}`).toBeGreaterThan(r);
  expect(g, `switch colour ${paint.bg}`).toBeGreaterThan(b);
  expect(paint.knob).toBe("rgb(255, 255, 255)");
});

test("TC 10.5 Type dal in search: only dishes with dal are shown", async ({ page, context }) => {
  await menuWith(page, context, MENU);
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // proves the list is not already filtered
  await page.getByRole("searchbox", { name: "Search dishes" }).fill("dal");
  await expect(page.getByRole("heading", { name: "Dal Makhani" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Veg Thali" })).toHaveCount(0);
});

test("TC 10.6 Tap the address: the Deliver to page opens", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);
  const search = page.getByRole("searchbox", { name: "Search dishes" });
  await expect(search).toBeVisible();   // proves the menu shows before the tap
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click();
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
  await expect(search).toHaveCount(0);
});

test("TC 10.7 Tap the profile circle: You opens", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);
  const search = page.getByRole("searchbox", { name: "Search dishes" });
  await expect(search).toBeVisible();
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByRole("region", { name: "Delivery details" })).toBeVisible();
  await expect(search).toHaveCount(0);
});

test("TC 10.8 Kitchen closes while open: the bill is cleared, the closed menu shows, and the line says so", async ({ page, context }) => {
  await page.clock.install({ time: new Date("2026-11-10T05:30:00Z") });   // 11:00 am in India: the kitchen is open
  await STEPS["menu"](context, page, PATH);
  // The kitchen's hours end at 11:10 am: the clock passes it while the bill has an item.
  await context.route(isPath("/rest/v1/kitchens"), (r) => answer(r, [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "09:00:00", closes_at: "11:10:00" }]));
  await page.reload();
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  const bar = page.getByRole("button", { name: "View bill (1) · ₹320" });
  await expect(bar).toBeVisible();   // proves a bill exists to be cleared
  await page.clock.fastForward(11 * 60_000);
  await expect(bar).toHaveCount(0);
  await expect(page.getByText("Kitchen closed. Opens at 9:00 am.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "The kitchen just closed. Your bill was cleared. Order again from 9:00 am." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toHaveCount(0);
});

test("TC 10.9 Bad network, reopen: the last menu shows with the no-connection line", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);   // this visit saves the menu on the phone
  const line = page.getByRole("status").filter({ hasText: "No connection. Showing the menu you saw last." });
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // proves the menu shows
  await expect(line).toHaveCount(0);   // and no line while the phone is online
  await context.addInitScript(() => Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true }));
  await page.reload();
  await expect(line).toBeVisible();
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // the saved menu, not an empty screen
});

test("TC 10.10 A dish sold out: its row is marked and has no Add", async ({ page, context }) => {
  await menuWith(page, context, MENU);
  await expect(page.getByRole("button", { name: "Add Dal Makhani" })).toBeVisible();   // proves Add shows on a dish that can be bought
  const sold = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Paneer Tikka" }) });
  await expect(sold).toBeVisible();
  await expect(sold.getByLabel("Sold out for today")).toBeVisible();
  await expect(sold.getByRole("button", { name: /^Add/ })).toHaveCount(0);
  await expect(sold).toHaveClass(/\bsold\b/);
});

test("TC 10.11 the pin mark in the Menu header never flies in: no animation after a fresh pick, and none after coming back from History", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ address: { road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } }) }));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await page.goto("/customer/");
  await firstOpenToMenu(page);
  const anim = () => page.locator(".ui-pin-svg").evaluate((el) => getComputedStyle(el).animationName);
  expect(await anim()).toBe("none");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(await anim()).toBe("none");
});
