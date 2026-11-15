// Story 1560: with no keyboard up, a bottom sheet and its grey cover reach the last pixel row of the screen. Shared by the Chromium and the WebKit spec.
// On an iPhone the visual viewport can be shorter than the window with no keyboard (a call or hotspot bar, the app opened from the home screen). A test browser
// cannot make that by itself, so a stand-in window.visualViewport is SHORT px shorter than the window. The WebKit spec also answers "display-mode: standalone"
// with yes (a stand-in for matchMedia; the app does not read it today). A bottom safe area cannot be set in a test browser.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, phoneAt, phoneLoc, setup, toDeliverTo } from "./helpers";

const SHORT = 34;
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const KITCHEN = { id: "k-1", name: "Sample Kitchen", address: "Sample Road", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
type Open = (page: Page, context: BrowserContext) => Promise<unknown>;

const shortViewport = (page: Page, standalone: boolean) => page.addInitScript(([short, alone]) => {
  const vv = Object.assign(new EventTarget(), { width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
  Object.defineProperty(vv, "height", { get: () => window.innerHeight - (short as number) });
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  window.addEventListener("resize", () => vv.dispatchEvent(new Event("resize")));
  if (alone) { const real = window.matchMedia.bind(window); window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? { ...real("all"), matches: true, media: q } as MediaQueryList : real(q)); }
}, [SHORT, standalone] as const);

// Every point of a grid over the lowest 100 px of the screen, down to the last pixel row, that does NOT hit the layer (the cover and what is in it).
const holes = (page: Page, layer: string) => page.evaluate((sel) => {
  (document.activeElement as HTMLElement | null)?.blur?.();   // no field has the focus: the keyboard is down
  const w = window.innerWidth, h = window.innerHeight, out: string[] = [];
  const all = document.querySelectorAll(sel); const top = all[all.length - 1];
  if (!top) return ["the sheet is not on the screen"];
  const end = Math.round(top.getBoundingClientRect().bottom);
  for (const y of [h - 100, h - 80, h - 60, h - 40, h - 30, h - 20, h - 10, h - 5, h - 2, h - 1]) for (const x of [1, Math.round(w / 4), Math.round(w / 2), Math.round(3 * w / 4), w - 2]) {
    const el = document.elementFromPoint(x, y);
    if (!el?.closest(sel)) out.push(`(${x}, ${y}) hits ${el ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}` : "nothing"}; the cover ends at ${end} of ${h} px`);
  }
  return out;
}, layer);
const reaches = (page: Page, layer = ".ui-sheet-back") => expect.poll(() => holes(page, layer), { timeout: 3000, message: "points in the lowest 100 px that are not the sheet or its cover" }).toEqual([]);

const customer = async (page: Page, context: BrowserContext, orders: object[] = []) => {
  const net = await setup(context, page, orders);
  net.state.addresses = [HOME];
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneAt(context, { lat: HOME.lat, lng: HOME.lng });   // the phone is at Home, so the location sheet does not open over the others
  await page.goto("/customer/");
  return net;
};
const admin = async (page: Page, context: BrowserContext, tab: string) => {
  const net = await setup(context, page); net.state.admin = true; net.state.kitchens = [KITCHEN];
  await page.goto("/admin/");
  await page.getByRole("button", { name: tab, exact: true }).click();
  if (tab === "City") await page.getByRole("button", { name: /^Open kitchen Sample Kitchen/ }).click();
};
const kitchen = async (page: Page, context: BrowserContext, path: string) => {
  const net = await setup(context, page, [order(path === "/kitchen/" ? "placed" : "accepted")]); net.state.kitchen = "k-1";
  await page.goto(path);
};
const locationSheet = async (page: Page, context: BrowserContext) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await phoneLoc(page, { perm: "denied", pos: 1 });
  await page.goto("/customer/");
  await expect(page.getByRole("dialog", { name: "Where to bring your food?" })).toBeVisible();
};
const whereBox = async (page: Page, context: BrowserContext) => {   // story 1548: the phone is far from every saved address, so the box that must be answered is up
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await context.addInitScript((h) => { window.localStorage.setItem("gs-place", JSON.stringify({ address: h.address, pin: h.pin_code, lat: h.lat, lng: h.lng, house: "", landmark: "", confirmed: true, id: h.id })); window.localStorage.setItem("gs-pin", h.pin_code); }, HOME);
  await phoneLoc(page, { perm: "granted", pos: { latitude: 28.6139, longitude: 77.209 } });
  await page.goto("/customer/");
  await expect(page.getByRole("dialog", { name: "Where should we deliver?" })).toBeVisible();
};

// [the sheet, how to open it, the dialog's name, the layer when it is not the grey cover]
const SHEETS: [string, Open, string | RegExp, string?][] = [
  ["Where to bring your food? (customer menu)", locationSheet, "Where to bring your food?"],
  ["Where should we deliver? (customer menu, story 1548)", whereBox, "Where should we deliver?"],
  ["a dish (customer menu)", async (p, c) => { await customer(p, c); await p.getByRole("button", { name: "Butter Chicken details" }).first().click(); }, "Butter Chicken"],
  ["edit or remove an address (Deliver to)", async (p, c) => { await customer(p, c); await toDeliverTo(p); await p.getByRole("button", { name: "Edit or remove Home" }).click(); }, "Home, edit or remove"],
  ["the You page (customer)", async (p, c) => { await customer(p, c); await p.getByRole("button", { name: /^You/ }).click(); }, "You", ".ui-you-page"],
  ["Delete your account? (You)", async (p, c) => { await customer(p, c); await p.getByRole("button", { name: /^You/ }).click(); await p.getByRole("button", { name: "Delete my account" }).click(); }, "Delete your account?"],
  ["Cancel this order? (customer)", async (p, c) => { await customer(p, c, [order("placed", "2020-01-01T10:01:00Z")]); await p.getByRole("button", { name: "Cancel order" }).click(); }, "Cancel this order?"],
  ["an order (kitchen)", async (p, c) => { await kitchen(p, c, "/kitchen/"); await p.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click(); }, "Order 0f0f0f0f"],
  ["Decline an order (kitchen)", async (p, c) => { await kitchen(p, c, "/kitchen/"); await p.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click(); await p.getByRole("button", { name: "Decline, with a reason" }).click(); }, "Decline order 0f0f0f0f"],
  ["Feedback (console)", async (p, c) => { await kitchen(p, c, "/console/"); await p.getByRole("button", { name: "Feedback" }).click(); }, "Feedback"],
  ["Remove a kitchen (admin)", async (p, c) => { await admin(p, c, "City"); await p.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click(); }, /^Remove /],
  ["Edit a kitchen (admin)", async (p, c) => { await admin(p, c, "City"); await p.getByRole("button", { name: "Edit details" }).click(); }, "Edit Sample Kitchen"],
  ["Edit a dish (admin)", async (p, c) => { await admin(p, c, "City"); await p.getByRole("button", { name: /^Edit Butter Chicken/ }).click(); }, "Edit Butter Chicken"],
  ["Clear everything? (admin)", async (p, c) => { await admin(p, c, "Simulator"); await p.getByRole("button", { name: "Clear everything" }).click(); }, "Clear everything?"],
  ["the demo sheet (styleguide)", async (p) => { await p.goto("/styleguide/"); await p.getByRole("button", { name: "Open sheet" }).click(); }, "Demo sheet"],
];

export function sheetToTheBottom({ standalone = false } = {}) {
  for (const size of SIZES) {
    const at = `${size.width}x${size.height}`;
    test(`${at}, the viewport is ${SHORT} px short and no keyboard is up: a tap under the last button of Where to bring your food? stays on the menu`, async ({ page, context }) => {
      await page.setViewportSize(size);
      await shortViewport(page, standalone);
      await locationSheet(page, context);
      await page.waitForTimeout(400);   // the sheet has come up
      await page.mouse.click(Math.round(3 * size.width / 4), size.height - 12);   // where the History tab sits under the sheet
      await page.waitForTimeout(300);
      await expect(page.getByRole("heading", { name: "History", exact: true }), "the tap reached the History tab under the sheet").toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Where to bring your food?" })).toBeVisible();
    });
    for (const [name, open, dialog, layer] of SHEETS) test(`${at}, the viewport is ${SHORT} px short and no keyboard is up: ${name} reaches the last pixel row`, async ({ page, context }) => {
      await page.setViewportSize(size);
      await shortViewport(page, standalone);
      await open(page, context);
      await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
      await reaches(page, layer);
    });
  }
}
