// Regression, screen 33: M5 Menu offline, M6 Offline empty, M7 Menu empty. Cases: .claude/handoff/qa/screens/33-Menu-states.md (epic #1196). Reached with the shared step STEPS["menu"] where a saved menu is needed; the empty menu is the step's own menu replaced by an empty list after the step, then the page reloads.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { setup } from "../helpers";

const PATH = "/customer/";
const OFFLINE_LINE = "No connection. Showing the menu you saw last.";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const dish = (id: string, name: string, category: string) =>
  ({ id, name, price_paise: 22000, image_url: null, image_credit: null, veg: true, category, available: true });

// Answers the menu read with a fixed list (and the browser's preflight); the shared step's own answer is the one before it.
function menuAnswer(context: BrowserContext, body: () => unknown) {
  return context.route(
    (url) => url.hostname === "test.supabase.co" && url.pathname === "/rest/v1/menu_items",
    (route: Route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body()) });
    },
  );
}

test("TC 33.1 Reopen with no network after one good visit: the last menu with the no-connection line", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);   // this visit saves the menu on the phone
  const line = page.getByRole("status").filter({ hasText: OFFLINE_LINE });
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // proves the menu shows online
  await expect(line).toHaveCount(0);   // and no line while the phone is online
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(line).toBeVisible();
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // the saved menu, not an empty screen
});

test("TC 33.2 No network and never loaded: our own empty offline state, never a browser error", async ({ page, context }) => {
  await setup(context, page);   // a first visit: nothing saved on the phone
  await context.setOffline(true);
  test.fail(true, "#1234: first visit with no network and no saved menu shows the browser's own error page (net::ERR_INTERNET_DISCONNECTED), not the app's offline screen");
  await page.goto(PATH);
  await expect(page.getByText("Could not connect to the internet.")).toBeVisible();   // the app's own screen shows
  await expect(page.getByText("Check your network, then try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);   // board M6: no header, no tabs
  await expect(page.getByText("This site can't be reached")).toHaveCount(0);   // never the browser's own error page
  await expect(page.getByText("No dishes on the menu yet.")).toHaveCount(0);
});

test("TC 33.3 Kitchen has no dishes: the Soon stamp, the empty line, Tell me when the menu is ready, Try another pin code", async ({ page, context }) => {
  // A phone that has never seen this kitchen's menu (no saved copy): the server answers with no dishes.
  const net = await setup(context, page);
  net.state.menu = [];
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "No dishes on the menu yet." })).toBeVisible();   // proves the empty screen shows
  await expect(page.getByText("Soon", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tell me when the menu is ready" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try another pin code" })).toBeVisible();
  await expect(page.getByText("Could not connect to the internet.")).toHaveCount(0);   // not the offline screen
  await expect(page.getByText(OFFLINE_LINE)).toHaveCount(0);
});

test("TC 33.4 Network comes back: the banner goes and the live menu shows without a reload", async ({ page, context }) => {
  await STEPS["menu"](context, page, PATH);   // the saved copy holds Butter Chicken
  const live = [dish("n1", "Paneer Pulao", "Mains")];
  await menuAnswer(context, () => live);
  const line = page.getByRole("status").filter({ hasText: OFFLINE_LINE });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(line).toBeVisible();
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toBeVisible();   // the saved menu shows while offline
  await page.evaluate(() => { (window as unknown as { __noReload: number }).__noReload = 1; });   // a reload would clear this mark
  await context.setOffline(false);
  await expect(line).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Paneer Pulao" })).toBeVisible();   // the live menu, read again
  await expect(page.getByRole("heading", { name: "Butter Chicken" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1);
});
