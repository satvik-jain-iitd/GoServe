// Story 1547 (owner, 15 Nov 2026, way A): the sheet "Where to bring your food?" opens by itself only when this phone holds no delivery place at the open.
// With a place chosen the app never opens it: the phone is followed when its place can be read without asking, else the place stays and nothing is shown.
// One list of scenarios, run by Chromium (sheet-only-with-no-place.spec.ts) and by WebKit, the iPhone engine (sheet-only-with-no-place.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { asked, phoneLoc, setup, toDeliverTo, type Loc } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "Z-900, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const AT_WORK = { latitude: 28.6209, longitude: 77.364 };
const sheet = (page: Page) => page.getByRole("dialog", { name: "Where to bring your food?" });
const header = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();
const menuOfHome = async (page: Page) => { await expect(header(page, /^Home\b/)).toBeVisible(); await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible(); };
const quiet = async (page: Page, ms = 700) => { await page.waitForTimeout(ms); await expect(page.getByRole("dialog")).toHaveCount(0); };   // the open is over (the addresses and the find answered) and nothing came up

// chosen: this phone holds Home, picked and ticked on an earlier open. Not chosen: a phone that holds no place.
async function open(context: BrowserContext, page: Page, loc: Loc, { chosen = true, rows = [HOME, WORK] } = {}) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = rows;
  if (chosen) await context.addInitScript((p) => {
    if (window.localStorage.getItem("gs-place")) return;   // only when nothing is there, so a second open keeps what the app wrote
    window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", p.pin);
  }, { address: HOME.address, pin: HOME.pin_code, lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: true, id: HOME.id });
  await phoneLoc(page, loc);
  await page.goto("/customer/");
  return net;
}

const CANNOT: [string, Loc][] = [
  ["off", { perm: "granted", pos: 2 }],
  ["blocked", { perm: "denied", pos: 1 }],
  ["never asked", { perm: "prompt", pos: "never" }],
  ["never asked, on an iPhone that cannot say so", { perm: null, pos: "never" }],
];

export function sheetOnlyWithNoPlace() {
  for (const [name, loc] of CANNOT) {
    test(`A place is chosen and the phone's place cannot be read (${name}): I open the app, I see the menu for my chosen place, and no sheet opens`, async ({ page, context }) => {
      await open(context, page, loc);
      await menuOfHome(page);
      await quiet(page);
      if (loc.perm !== "granted") expect(await asked(page)).toBe(0);   // the phone is never asked for its place on an open
    });
  }

  test("No place at all, a new customer: the first-open screen shows, as today", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: "never" }, { chosen: false, rows: [] });
    await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
    await quiet(page, 500);
  });

  test("No place at all, a new phone of a customer with saved addresses: the sheet shows, as today", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: "never" }, { chosen: false });
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: /^Home\b/ })).toHaveAttribute("aria-current", "true");   // the address used last is offered, ticked
  });

  test("I ask for it: with a chosen place, I tap the place at the top, and the place chooser opens", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: "never" });
    await menuOfHome(page);
    await toDeliverTo(page);
    await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use current location" })).toBeVisible();   // the ask for the phone's place lives on a tap
    expect(await asked(page)).toBe(0);
  });

  test("Every open: a place is chosen and the phone's place cannot be read, I open the app three times, and the sheet never opens by itself", async ({ page, context }) => {
    await open(context, page, { perm: "denied", pos: 1 });
    for (let n = 1; n <= 3; n++) {
      if (n > 1) await page.reload();
      await menuOfHome(page);
      await quiet(page);
    }
  });

  test("A slow find: a place is chosen and the phone does not answer in time, and the sheet never opens late", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: "never" });
    await menuOfHome(page);
    await quiet(page, 6000);   // the app waits 5 seconds for the phone
    await menuOfHome(page);
  });

  test("The phone's place can be read without asking: the place follows the phone, as in story 1529, and no sheet opens", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AT_WORK });
    await expect(header(page, /^Work\b/)).toBeVisible();
    await quiet(page);
  });
}
