// Story #1524 (owner, 14 Nov 2026): on the two first-open screens the ask (the two buttons) shows after the motion ends, not at once.
// The page itself records what it shows at the first and the last moment of the motion, so the test does not race a clock.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

type Shot = { buttons: string[]; boxes: Record<string, number[]> };
type Seen = { start?: Shot; end?: Shot };
const ALERTS = { motion: "ui-alert-drop", buttons: ["I'll check the app myself", "Turn on alerts"] };
const PLACE = { motion: "ui-ride-in", buttons: ["Search for my address", "Use my current location"] };

// Records, at the start and at the end of the named motion: is each ".ui-slip .ui-btn" shown, and where the title, the picture, the slip and the buttons sit.
async function watch(context: BrowserContext, motion: string, swallowEnd = false) {
  await context.addInitScript(([name, swallow]) => {
    const seen: Seen = ((window as unknown as { __seen: Seen }).__seen = {});
    const shot = (): Shot => {
      const box = (sel: string) => [...document.querySelectorAll(sel)].flatMap((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });
      return { buttons: [...document.querySelectorAll(".ui-slip .ui-btn")].map((b) => getComputedStyle(b).visibility), boxes: { title: box(".ui-slip-title"), hero: box(".ui-hero-abs"), slip: box(".ui-slip"), buttons: box(".ui-slip .ui-btn") } };
    };
    window.addEventListener("animationstart", (e) => { if (e.animationName === name) seen.start = shot(); }, true);
    window.addEventListener("animationend", (e) => { if (e.animationName === name) { seen.end = shot(); if (swallow) e.stopImmediatePropagation(); } }, true);
  }, [motion, swallowEnd] as const);
}
const seen = (page: Page) => page.evaluate(() => (window as unknown as { __seen: Seen }).__seen);
const boxes = (page: Page) => page.evaluate(() => {
  const box = (sel: string) => [...document.querySelectorAll(sel)].flatMap((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });
  return { title: box(".ui-slip-title"), hero: box(".ui-hero-abs"), slip: box(".ui-slip"), buttons: box(".ui-slip .ui-btn") };
});

async function alerts(context: BrowserContext, page: Page) {
  await setup(context, page, [], { pin: null });
  await context.addInitScript(() => { Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true }); });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();
}
async function place(context: BrowserContext, page: Page) {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
}
async function shown(page: Page, names: string[]) { for (const name of names) await expect(page.getByRole("button", { name })).toBeVisible(); }

test("The alert ask waits for the motion: the two buttons are not there while the sample alert drops in, and show when it has landed", async ({ page, context }) => {
  await watch(context, ALERTS.motion);
  await alerts(context, page);
  await shown(page, ALERTS.buttons);
  const s = await seen(page);
  expect(s.start?.buttons).toEqual(["hidden", "hidden"]);   // the motion begins: no ask yet
  expect(s.end?.buttons).toEqual(["hidden", "hidden"]);     // its last moment: still no ask; it comes after
});

test("The location ask waits for the motion: the two buttons are not there while the rider rides in, and show when the rider has stopped", async ({ page, context }) => {
  await watch(context, PLACE.motion);
  await place(context, page);
  await shown(page, PLACE.buttons);
  const s = await seen(page);
  expect(s.start?.buttons).toEqual(["hidden", "hidden"]);
  expect(s.end?.buttons).toEqual(["hidden", "hidden"]);
});

test("Reduce motion: the buttons show at once on both screens", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await alerts(context, page);
  expect(await page.locator(".ui-slip .ui-btn").evaluateAll((bs) => bs.map((b) => getComputedStyle(b).visibility))).toEqual(["visible", "visible"]);   // no wait: read at once, not polled
  await page.getByRole("button", { name: "I'll check the app myself" }).click();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  expect(await page.locator(".ui-slip .ui-btn").evaluateAll((bs) => bs.map((b) => getComputedStyle(b).visibility))).toEqual(["visible", "visible"]);
});

test("A short phone has no sample alert and no rider on the ask: the buttons show at once", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await alerts(context, page);
  expect(await page.locator(".ui-slip .ui-btn").evaluateAll((bs) => bs.map((b) => getComputedStyle(b).visibility))).toEqual(["visible", "visible"]);
  await page.getByRole("button", { name: "I'll check the app myself" }).click();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  expect(await page.locator(".ui-slip .ui-btn").evaluateAll((bs) => bs.map((b) => getComputedStyle(b).visibility))).toEqual(["visible", "visible"]);
});

for (const [label, s, open] of [["alerts", ALERTS, alerts], ["location", PLACE, place]] as const) {
  test(`Nothing jumps (${label}): the title, the picture, the slip and the buttons' own places are the same before and after the buttons show`, async ({ page, context }) => {
    await watch(context, s.motion);
    await open(context, page);
    await shown(page, [...s.buttons]);
    const start = (await seen(page)).start!;
    expect(start.buttons).toEqual(["hidden", "hidden"]);   // the space was kept while they were not shown
    expect(await boxes(page)).toEqual(start.boxes);
  });

  test(`The phone never says the motion ended (${label}): the buttons still show`, async ({ page, context }) => {
    await watch(context, s.motion, true);   // the page swallows animationend, as a phone that drops it would
    await open(context, page);
    await expect.poll(async () => (await seen(page)).start?.buttons).toEqual(["hidden", "hidden"]);   // the motion has begun (the alert waits 0.6 s first)
    await shown(page, [...s.buttons]);
  });
}

test("The taps do what they did: Turn on alerts moves on to the location ask, and its two buttons work", async ({ page, context }) => {
  await alerts(context, page);
  await page.getByRole("button", { name: "Turn on alerts" }).click();
  await shown(page, PLACE.buttons);
  await page.getByRole("button", { name: "Search for my address" }).click();
  await expect(page.getByRole("button", { name: "Search for my address" })).toHaveCount(0);
});
