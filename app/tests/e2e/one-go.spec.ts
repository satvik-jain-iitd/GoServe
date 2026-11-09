// Story #1134 (owner phone test 9 Nov: "everything should load at once, not one by one"): a screen shows its loading state until its first view is ready,
// the data and the photos of the first screenful decoded; then it appears in one go. A 1.2 s cap keeps it honest (the photo placeholder fills the slot); a wait under 300 ms
// shows no loading state at all; the slots keep their size so nothing moves; the profile banner is there on the first paint.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const DISHES = [1, 2, 3].map((n) => ({ id: `d${n}`, name: `Dish ${n}`, price_paise: 10000 + n, image_url: `https://img.test/d${n}.png`, image_credit: null }));

async function menuWith(page: Page, context: BrowserContext, photoMs: number) {
  const net = await setup(context, page);
  net.state.menu = DISHES;
  const seen = new Set<string>();   // a real server caches: only the first request for a photo is slow
  await context.route("https://img.test/**", async (route) => { const u = route.request().url(); if (!seen.has(u)) { seen.add(u); await new Promise((r) => setTimeout(r, photoMs)); } await route.fulfill({ status: 200, contentType: "image/png", headers: { "cache-control": "max-age=3600" }, body: PNG }); });
  return net;
}
const rows = (page: Page) => page.locator(".ui-tile");
const watch = (page: Page) => page.addInitScript(() => {   // what the customer could have seen, with times: when rows first appeared, whether the skeleton ever did, the layout shift after the rows
  const w = window as any; w.__rows = null; w.__skel = false; w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput && w.__rows !== null) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: false });
  new MutationObserver(() => {
    if (w.__rows === null && document.querySelectorAll(".ui-tile").length > 0) w.__rows = { at: performance.now(), done: [...document.querySelectorAll<HTMLImageElement>(".ui-tile img")].filter((i) => i.complete && i.naturalWidth > 0).length, imgs: document.querySelectorAll(".ui-tile img").length, ph: document.querySelectorAll(".ui-tile .ui-ph").length, n: document.querySelectorAll(".ui-tile").length };
    if (document.querySelector(".ui-menu-skel, [aria-label='Loading the menu'] .ui-skel, .ui-hero .ui-skel")) w.__skel = true;
  }).observe(document, { childList: true, subtree: true });
});

test("S1 photos that come in 600 ms: no dish row before they are decoded, then every row with its photo at once", async ({ page, context }) => {
  await watch(page);
  await menuWith(page, context, 600);
  await page.goto("/customer/");
  await expect(rows(page).first()).toBeVisible({ timeout: 5_000 });
  const r = await page.evaluate(() => (window as any).__rows);
  expect(r.n).toBe(3);                    // all the rows together
  expect(r.at).toBeGreaterThanOrEqual(600);   // not before the photos (600 ms) were in: the rows did not come first and the photos one by one
  await expect.poll(() => page.locator(".ui-tile img").evaluateAll((l) => l.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length), { timeout: 700 }).toBe(3);   // and every photo is drawn right after
  expect(r.ph).toBe(0);                   // no placeholder in the first view
});

test("S2 photos that take 3 s: the 1.2 s cap shows the rows with the plate in each slot, the slot keeps its size, the photo comes in later", async ({ page, context }) => {
  await watch(page);
  await menuWith(page, context, 3000);
  const t0 = Date.now();
  await page.goto("/customer/");
  await expect(rows(page).first()).toBeVisible({ timeout: 4_000 });
  expect(Date.now() - t0).toBeLessThan(2_600);   // the cap, plus the page's own start
  const r = await page.evaluate(() => (window as any).__rows);
  expect([r.n, r.ph]).toEqual([3, 3]);           // every slot holds the plate
  const box = async () => (await page.locator(".ui-tile .ui-photo-btn").first().boundingBox())!;
  const before = await box();
  await expect.poll(async () => page.locator(".ui-tile img").count(), { timeout: 8_000 }).toBe(3);   // the photos arrive
  const after = await box();
  expect([after.width, after.height, after.y]).toEqual([before.width, before.height, before.y]);   // and nothing moved
  expect(await page.evaluate(() => (window as any).__cls)).toBeLessThan(0.01);
});

test("S3 photos already in the cache: no loading state is flashed at all", async ({ page, context }) => {
  await watch(page);
  await menuWith(page, context, 0);
  await page.goto("/customer/");
  await expect(rows(page).first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).__skel)).toBe(false);
});

test("S4 the profile banner reads the session already in memory: it is there on the first paint, not after a slow call", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.anonymous = false; net.state.userEmail = "amit@example.test";
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await context.route("https://test.supabase.co/auth/v1/user", async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }); });
  await page.reload();
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByTestId("signed-in")).toHaveText("Signed in as Amit Kumar", { timeout: 800 });   // far less than the 3 s the call takes
});
