// Story #1133 (boards O0g-C, N0b, A1c; owner approved 9 Nov; ShipQuick #164): the first-open steps share one layout. The slip runs to 24 px above the edge plus the safe area; the main
// (filled) button is last at the bottom, an outline one sits above it, and the main button has the same y on every step; the hero (thali plate, bell, pin circle) centre sits 268 px
// below the slip top; nothing scrolls sideways at 320 px with large text. Enter address manually opens the search, focused, and Type it by hand is gone.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { setup } from "./helpers";

type Step = { name: string; main: string; ghost?: string; hero: string };
const WELCOME: Step = { name: "welcome", main: "Continue with Google", hero: ".ui-welcome-pic" };
const ALERTS: Step = { name: "alerts", main: "Turn on alerts", ghost: "I'll check the app myself", hero: ".ui-bellbadge" };
const AREA: Step = { name: "area", main: "Set delivery location", ghost: "Enter address manually", hero: ".ui-pinbadge" };

async function open(page: Page, context: BrowserContext, s: Step) {
  const net = await setup(context, page, [], { guest: s === WELCOME, pin: null });
  await context.addInitScript(() => { Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true }); });
  if (s === AREA) await context.addInitScript(() => { try { localStorage.setItem("gs_alerts_asked", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: s.main })).toBeVisible();
  return net;
}
const slip = (page: Page) => page.locator(".ui-slip").first();
const y = async (page: Page, name: string) => (await page.getByRole("button", { name }).boundingBox())!;

const seen: Record<string, { main: { y: number; h: number }; ghost?: { y: number; h: number }; slipTop: number; slipBottom: number; hero: { y: number; h: number } }> = {};
test.describe.configure({ mode: "serial" });
for (const s of [WELCOME, ALERTS, AREA]) {
  test(`measure ${s.name}`, async ({ page, context }) => {
    await open(page, context, s);
    const bb = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    const main = await y(page, s.main), ghost = s.ghost ? await y(page, s.ghost) : undefined, sl = (await slip(page).boundingBox())!, hero = await bb(s.hero);
    seen[s.name] = { main: { y: main.y, h: main.height }, ghost: ghost && { y: ghost.y, h: ghost.height }, slipTop: sl.y, slipBottom: sl.y + sl.height, hero: { y: hero.y, h: hero.height } };
  });
}

test("S1 the main button has the same y on all three steps, and the slip ends 24 px above the edge", async ({ page }) => {
  const mains = Object.values(seen).map((v) => v.main.y);
  expect(Math.max(...mains) - Math.min(...mains)).toBeLessThanOrEqual(2);
  const tops = Object.values(seen).map((v) => v.slipTop);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);   // and the slip starts at the same height, so the steps do not jump
  for (const v of Object.values(seen)) expect(Math.abs(v.slipBottom - (page.viewportSize()!.height - 24))).toBeLessThanOrEqual(2);
});

test("S2 the outline button sits above the main one, and the main one is last, at the foot of the slip", async () => {
  for (const n of ["alerts", "area"]) {
    const v = seen[n];
    expect(v.ghost!.y + v.ghost!.h).toBeLessThanOrEqual(v.main.y);
    expect(v.main.y + v.main.h).toBeGreaterThan(v.slipBottom - 40);
  }
});

test("S3 the hero centre sits 268 px below the slip top on every step", async () => {
  for (const n of ["alerts", "area"]) expect(Math.abs(seen[n].hero.y + seen[n].hero.h / 2 - (seen[n].slipTop + 268))).toBeLessThanOrEqual(2);
  expect(Math.abs(seen.welcome.hero.y - (seen.welcome.slipTop + 157))).toBeLessThanOrEqual(2);   // the thali picture sits 157 px below the slip top: its plate is at the same 268
});

test("S4 at 320 px with large text nothing scrolls sideways and no button clips its words", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const s of [ALERTS]) {   // each step is its own start: the other two are covered by the same rules in the next two tests
    await open(page, context, s);
    await page.addStyleTag({ content: "html { font-size: 130%; } .ui-kicker, .ui-welcome-kicker { font-size: 17px !important; }" });
    const m = await page.evaluate(() => ({ s: document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth, l: (document.querySelector(".ui-landing, .ui-welcome") as HTMLElement).scrollWidth - (document.querySelector(".ui-landing, .ui-welcome") as HTMLElement).clientWidth,
      clipped: [...document.querySelectorAll<HTMLElement>(".ui-landing .ui-btn, .ui-welcome .ui-btn")].filter((b) => b.scrollHeight > b.clientHeight + 1).length }));
    expect([m.s, m.l, m.clipped]).toEqual([0, 0, 0]);
  }
});

for (const s of [WELCOME, AREA]) {
  test(`S4 ${s.name}: at 320 px with large text nothing scrolls sideways and no button clips its words`, async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page, context, s);
    await page.addStyleTag({ content: "html { font-size: 130%; } .ui-kicker, .ui-welcome-kicker { font-size: 17px !important; }" });
    const m = await page.evaluate(() => ({ s: document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth, l: (document.querySelector(".ui-landing, .ui-welcome") as HTMLElement).scrollWidth - (document.querySelector(".ui-landing, .ui-welcome") as HTMLElement).clientWidth,
      clipped: [...document.querySelectorAll<HTMLElement>(".ui-landing .ui-btn, .ui-welcome .ui-btn")].filter((b) => b.scrollHeight > b.clientHeight + 1).length }));
    expect([m.s, m.l, m.clipped]).toEqual([0, 0, 0]);
  });
}

test("S5 Type it by hand is gone; Enter address manually opens the search, focused", async ({ page, context }) => {
  await open(page, context, AREA);
  await expect(page.getByRole("button", { name: "Type it by hand" })).toHaveCount(0);
  await page.getByRole("button", { name: "Enter address manually" }).click();
  const search = page.getByRole("searchbox", { name: "Search an area or address" });
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
});

test("S6 Set delivery location with the location denied lands on the same search, focused", async ({ page, context }) => {
  await open(page, context, AREA);
  await context.setGeolocation(null as never).catch(() => undefined);
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_ok, err) => err?.({ code: 1, message: "denied" } as GeolocationPositionError); });
  await page.reload();
  await page.getByRole("button", { name: "Set delivery location" }).click();
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeFocused();
});
