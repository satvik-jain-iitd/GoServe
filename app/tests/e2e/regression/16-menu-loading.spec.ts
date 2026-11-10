// Regression, screen 16: S-Loading Menu loading. Cases: .claude/handoff/qa/screens/16-S-Loading.md (epic #1196, story #1197). Reached with the shared step STEPS["menu"].
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const MENU = (url: URL) => url.href.startsWith("https://test.supabase.co/rest/v1/menu_items");   // the menu read, nothing else
const LOADING = (page: Page) => page.getByLabel("Loading the menu");

// What the customer could have seen: the first time a dish row appears, how many photos were already drawn.
const watch = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __first: unknown };
  w.__first = null;
  new MutationObserver(() => {
    if (w.__first === null && document.querySelectorAll(".ui-tile").length > 0) {
      const rows = document.querySelectorAll(".ui-tile").length;
      const ph = document.querySelectorAll(".ui-tile .ui-ph").length;
      w.__first = { rows, imgs: 0, decoded: 0, ph };   // filled in on the next frame, so a photo that is still loading shows as not decoded
      requestAnimationFrame(() => {
        const imgs = [...document.querySelectorAll<HTMLImageElement>(".ui-tile img")];
        w.__first = { rows, imgs: imgs.length, decoded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, ph };
      });
    }
  }).observe(document, { childList: true, subtree: true });
});

test("TC 16.1 Open the menu on a slow network: one loading state, then the whole menu at once, no rows or photos popping in (#1134)", async ({ page, context }) => {
  await watch(page);
  const dishes = [
    { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: "https://img.test/d1.png", image_credit: null },
    { id: "d2", name: "Paneer Tikka", price_paise: 24000, image_url: "https://img.test/d2.png", image_credit: null },
    { id: "d3", name: "Dal Makhani", price_paise: 18000, image_url: "https://img.test/d3.png", image_credit: null },
  ];
  // The slow network: the menu waits on the gate below, and each photo takes 600 ms the first time (a real server caches after that).
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route(MENU, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    await gate;   // the slow network: the menu waits until the test lets it through
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(dishes) });
  });
  const seen = new Set<string>();
  await context.route("https://img.test/**", async (route) => {
    const u = route.request().url();
    if (!seen.has(u)) { seen.add(u); await new Promise((r) => setTimeout(r, 600)); }
    await route.fulfill({ status: 200, contentType: "image/png", headers: { "cache-control": "max-age=3600" }, body: PNG });
  });
  const reached = STEPS.menu(context, page, PATH);
  reached.catch(() => undefined);   // the step's own failure is reported when it is awaited below
  await expect(LOADING(page)).toBeVisible();   // the one loading state shows while the menu is on its way
  await expect(page.locator(".ui-tile")).toHaveCount(0);   // and no row before the data and the photos
  release();   // the menu comes in now
  await reached;
  await expect(LOADING(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __first: unknown }).__first)).toEqual({ rows: 3, imgs: 3, decoded: 3, ph: 0 });   // all three rows came in together, every photo drawn, no placeholder
});

test("TC 16.2 the Veg switch is grey with a white knob when off (SW5a)", async ({ page, context }) => {
  await STEPS.menu(context, page, PATH);
  const sw = page.getByRole("switch", { name: "Veg only, whole menu" });
  await expect(sw).toBeVisible();
  await expect(sw).not.toBeChecked();
  // The expected colours are read from the design tokens, as spec 17 does: a probe element resolves each var().
  const token = (name: string) => page.evaluate((v) => {
    const t = document.createElement("i");
    t.style.backgroundColor = `var(${v})`;
    document.body.append(t);
    const c = getComputedStyle(t).backgroundColor;
    t.remove();
    return c;
  }, name);
  const off = await token("--gs-switch-off");   // the light grey off track (#C9CFC3)
  const knob = await token("--gs-switch-knob");   // the white knob (#ffffff)
  await expect.poll(() => sw.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(off);
  await expect.poll(() => sw.evaluate((e) => getComputedStyle(e, "::before").backgroundColor)).toBe(knob);
});

// The 500 path (MenuScreen.tsx shows the network line for every failure) is issue #1250. This test covers the network-down path only.
test("TC 16.3 the menu call fails: our own line with Try again, no blank page", async ({ page, context }) => {
  await STEPS.menu(context, page, PATH);   // the menu shows first, so the failure below is the only thing that changes
  let failing = true;
  await page.route(MENU, async (route) => {
    if (route.request().method() === "OPTIONS" || !failing) return route.fallback();
    return route.abort("failed");   // the network is down: the call never gets an answer
  });
  // No saved menu on this phone, so the failed call has nothing to fall back on.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("gs.menu.v1")) localStorage.removeItem(k); });
  await page.reload();
  const line = page.getByRole("alert").filter({ hasText: "Could not connect to the internet." });
  await expect(line).toBeVisible({ timeout: 10_000 });   // after the second read fails (the app waits 1.5 s between reads)
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toHaveCount(0);
  failing = false;   // the network is back
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // Try again reads the menu and shows it
});

test("TC 16.4 the menu takes over 10 s: a line that it is slow, with the last menu shown", async ({ page, context }) => {
  await STEPS.menu(context, page, PATH);   // this phone now has the menu saved
  await page.route(MENU, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    await new Promise(() => undefined);   // the menu never answers; the app's own 4 s limit ends each read
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible({ timeout: 10_000 });   // the last menu shows after the first read gives up (about 4 s)
  await expect(page.getByText("GoServe is slow right now. Showing the menu you saw last.")).toBeVisible({ timeout: 20_000 });   // after the second read times out too
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // and the menu is still there under the line
});
