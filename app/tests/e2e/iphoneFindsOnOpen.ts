// Story 1610 (owner, 17 Nov 2026, his iPhone on prod): Safari on iPhone answers "prompt" to permissions.query even after the customer allowed location, so the app
// never looked by itself and showed "We can't see where you are right now" on every open. The rule now: a mark on this phone (gs-loc-ok) is set after any find that
// worked; with no tap the app reads the phone's place when the browser says "granted" or the mark is set, and never when it says "denied".
// One list of cases, run by Chromium (iphone-finds-on-open.spec.ts) and by WebKit, the iPhone engine (iphone-finds-on-open.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { asked, comeBack, phoneLoc, setLoc, setup, toDeliverTo, type Loc } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const AT_WORK = { latitude: 28.6209, longitude: 77.364 };
const header = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();
const box = (page: Page) => page.getByRole("region", { name: "Delivering to" });
const theMark = (page: Page) => page.evaluate(() => window.localStorage.getItem("gs-loc-ok"));
const quiet = async (page: Page, ms = 700) => { await page.waitForTimeout(ms); await expect(page.getByRole("dialog")).toHaveCount(0); };
const NEVER_ASKED: [string, Loc["perm"]][] = [["the iPhone says prompt", "prompt"], ["an old iPhone with no permissions.query", null]];

// This phone holds Home, chosen on an earlier open. mark: a find worked on this phone before (set once, so a reload keeps what the app did to it).
async function open(context: BrowserContext, page: Page, loc: Loc, mark: boolean) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.addInitScript(({ p, mark }) => {
    if (window.sessionStorage.getItem("t-seeded")) return;
    window.sessionStorage.setItem("t-seeded", "1");
    window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", p.pin);
    if (mark) window.localStorage.setItem("gs-loc-ok", "1");
  }, { p: { address: HOME.address, pin: HOME.pin_code, lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: true, id: HOME.id }, mark });
  await phoneLoc(page, loc);
  await page.goto("/customer/");
  return net;
}

export function iphoneFindsOnOpen() {
  for (const [name, perm] of NEVER_ASKED) {
    test(`A find worked on this phone before (${name}): I open the app, the phone is found with no tap, and the saved address I am at is picked`, async ({ page, context }) => {
      await open(context, page, { perm, pos: AT_WORK }, true);
      await expect(header(page, /^Work\b/)).toBeVisible();
      await quiet(page);
      await toDeliverTo(page);
      await expect(box(page)).toHaveCount(0);   // no grey box
    });

    test(`No find ever worked on this phone (${name}): I open the app, the phone is never asked for its place, and Deliver to shows no box`, async ({ page, context }) => {
      await open(context, page, { perm, pos: AT_WORK }, false);
      await expect(header(page, /^Home\b/)).toBeVisible();
      await quiet(page);
      await toDeliverTo(page);
      await expect(page.getByRole("button", { name: "Use current location" })).toBeVisible();
      await expect(box(page)).toHaveCount(0);
      await comeBack(page);   // the return to the app follows the same rule
      await quiet(page, 300);
      expect(await asked(page)).toBe(0);
    });
  }

  test("Location is blocked for the app, with the mark set: the phone is never asked, and Deliver to says the true box", async ({ page, context }) => {
    await open(context, page, { perm: "denied", pos: AT_WORK }, true);
    await expect(header(page, /^Home\b/)).toBeVisible();
    await quiet(page);
    await toDeliverTo(page);
    await expect(box(page)).toContainText("Location is off or blocked");
    expect(await asked(page)).toBe(0);
  });

  test("The phone says no (code 1) with the mark set: the mark is gone, and the next open does not ask the phone", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: 1 }, true);
    await expect(header(page, /^Home\b/)).toBeVisible();
    await expect.poll(() => asked(page)).toBe(1);
    await expect.poll(() => theMark(page)).toBeNull();
    await page.reload();
    await expect(header(page, /^Home\b/)).toBeVisible();
    await quiet(page);
    expect(await asked(page)).toBe(0);
  });

  test("A tap that finds the phone sets the mark: the next open finds the phone with no tap", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: AT_WORK }, false);
    await toDeliverTo(page);
    expect(await theMark(page)).toBeNull();
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect.poll(() => theMark(page)).toBe("1");
    await page.reload();
    await expect(header(page, /^Work\b/)).toBeVisible();
  });

  test("Sign out of this phone: the mark is gone, and the next open does not ask the phone", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: AT_WORK }, true);
    await expect(header(page, /^Work\b/)).toBeVisible();   // found with no tap, so the mark was used
    expect(await theMark(page)).toBe("1");
    await page.getByRole("button", { name: /^You: / }).click();
    await page.getByRole("button", { name: "Sign out of this phone" }).click();
    await page.getByRole("dialog", { name: "Sign out of this phone?" }).getByRole("button", { name: "Sign out", exact: true }).click();
    await expect.poll(() => asked(page)).toBe(0);   // the page loaded again: the count starts over
    await page.waitForTimeout(700);
    expect(await theMark(page)).toBeNull();
    expect(await asked(page)).toBe(0);
  });

  test("The phone's location is off: Deliver to keeps its true box with no tap", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: 2 }, false);
    await expect(header(page, /^Home\b/)).toBeVisible();
    await toDeliverTo(page);
    await expect(box(page)).toContainText("Your phone's location is off");
  });

  test("The phone is too slow: Deliver to shows no box by itself, and the box comes only after my tap", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: 3 }, false);
    await expect(header(page, /^Home\b/)).toBeVisible();
    await expect.poll(() => asked(page)).toBe(1);
    await toDeliverTo(page);
    await quiet(page, 300);
    await expect(box(page)).toHaveCount(0);
    await setLoc(page, { perm: "granted", pos: 3 });
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(box(page)).toContainText("Finding you is taking too long");
  });
}
