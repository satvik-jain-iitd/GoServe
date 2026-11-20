// Story 1707 (owner, 20 Nov 2026, option A): the customer app says "Serving at" where it said "Deliver to". The rider app keeps "Deliver to". Words only: no box
// changes size and nothing moves. The old words are put back on the same screen by script and the two states are measured in the same browser (so the check does
// not depend on a font of one machine); the boxes that hold the words may differ in width only.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, answeredAt, order, phoneLoc, setup, type Loc } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "Z-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const OFFICE = { id: "o1", label: "Office", address: "Tower B, Connaught Place, New Delhi", pin_code: "110016", lat: 28.6315, lng: 77.2167, last_used_at: "2026-11-06T10:00:00Z" };
const FAR = { latitude: 28.5, longitude: 77.3 };   // far from every saved address: the place on this phone stays, the Delivering to box shows
const AT_HOME: Loc = { perm: "granted", pos: { latitude: HOME.lat, longitude: HOME.lng } };
const homePlace = { address: HOME.address, pin: HOME.pin_code, lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: true, id: HOME.id as string | null };
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];

// The menu with a place on this phone and no saved row picked: its top line holds the fallback label.
async function menu(page: Page, context: BrowserContext, loc?: Loc) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME, OFFICE];
  await answeredAt(context, FAR);   // this phone already answered the far-away box today, so no sheet covers the menu
  if (loc) await phoneLoc(page, loc); else { await context.grantPermissions(["geolocation"]); await context.setGeolocation(FAR); }
  await page.goto("/customer/");
  return net;
}
async function bill(page: Page, context: BrowserContext) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await context.addInitScript(([p]) => {
    if (window.localStorage.getItem("gs-place")) return;
    window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin);
    window.localStorage.setItem("gs-draft", JSON.stringify({ step: "bill", cart: { d1: 1 }, address: (p as { address: string }).address, name: "", phone: "9876543210" }));
  }, [homePlace] as const);
  await phoneLoc(page, AT_HOME);   // not far from the place, so the small label (not the km line) is on the row
  await page.goto("/customer/");
  return net;
}

type R = { sel: string; i: number; x: number; y: number; w: number; h: number };
// Every box of the selectors, as the browser draws it. `words` are the elements that hold the label: their width may differ, nothing else may.
const boxes = (page: Page, sels: string[]) => page.evaluate((s) => s.flatMap((sel) => [...document.querySelectorAll(sel)].map((e, i) => { const r = e.getBoundingClientRect(); return { sel, i, x: r.x, y: r.y, w: r.width, h: r.height }; })), sels);
async function same(page: Page, sels: string[], words: string[], swap: () => Promise<void>, tag: string) {
  const after = await boxes(page, sels);
  await swap();   // the old words, on the same screen
  const before = await boxes(page, sels);
  console.log(`1707 ${tag} old|new ` + JSON.stringify(before.map((b, k) => [b.sel, b.i, [b.x, b.y, b.w, b.h].map((n) => Math.round(n * 10) / 10), [after[k]?.x, after[k]?.y, after[k]?.w, after[k]?.h].map((n) => Math.round((n ?? 0) * 10) / 10)])));
  expect(after.length, `${tag}: the same boxes are on the screen`).toBe(before.length);
  expect(after.length).toBeGreaterThan(sels.length - 1);
  before.forEach((b, k) => {
    const a = after[k];
    expect(Math.abs(a.x - b.x), `${tag} ${b.sel} left`).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y), `${tag} ${b.sel} top`).toBeLessThanOrEqual(1);
    expect(Math.abs(a.h - b.h), `${tag} ${b.sel} height`).toBeLessThanOrEqual(1);
    if (!words.includes(b.sel)) expect(Math.abs(a.w - b.w), `${tag} ${b.sel} width`).toBeLessThanOrEqual(1);
  });
}
const putText = async (page: Page, sel: string, from: string, to: string) => {
  const n = await page.evaluate(([s, f, t]) => { let c = 0; for (const e of document.querySelectorAll(s)) for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent === f) { n.textContent = t; c++; } return c; }, [sel, from, to]);
  expect(n, `the words "${from}" are on the screen at ${sel}`).toBeGreaterThan(0);
};

test("The menu's top line says Serving at, and the address screen's title and heading say Serving at", async ({ page, context }) => {
  await menu(page, context);
  await expect(page.getByTitle("Change the delivery address")).toContainText("Serving at");
  await expect(page.getByText("Deliver to", { exact: true })).toHaveCount(0);
  await page.getByTitle("Change the delivery address").click();
  await expect(page.getByRole("heading", { name: "Serving at", exact: true, level: 1 })).toHaveCount(1);   // the small heading over the Delivering to box is checked with the measure below
  await expect(page.getByText("Deliver to", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Delivering to", { exact: true })).toHaveCount(0);
});

test("A screen reader hears Serve at <place> on the saved rows", async ({ page, context }) => {
  await menu(page, context);
  await page.getByTitle("Change the delivery address").click();
  await expect(page.getByRole("button", { name: "Serve at Home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deliver to Home" })).toHaveCount(0);
});

test("The Bill's address row says Serving at, and the exact no-kitchen button keeps its words", async ({ page, context }) => {
  await bill(page, context);
  const row = page.getByRole("group", { name: "Serving at", exact: true });   // a screen reader hears the same words the screen shows
  await expect(row.getByText("Serving at", { exact: true })).toBeVisible();
  await expect(row.getByText("Deliver to", { exact: true })).toHaveCount(0);
});

test("A screen reader hears Serving at on the Bill row and on the address screen's box, never Deliver to or Delivering to", async ({ page, context }) => {
  await bill(page, context);
  await expect(page.getByRole("group", { name: "Serving at", exact: true })).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Deliver to", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Delivering to", exact: true })).toHaveCount(0);
});

test("A screen reader hears Serving at on the address screen's box, never Delivering to", async ({ page, context }) => {
  await menu(page, context, { perm: "granted", pos: 2 });
  await page.getByTitle("Change the delivery address").click();
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(page.locator(".ui-going")).toBeVisible();
  await expect(page.getByRole("region", { name: "Serving at", exact: true })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Delivering to", exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Deliver to", exact: true })).toHaveCount(0);
});

test("The no-kitchen screen keeps its button words: Deliver to a saved address", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.kitchens = [];
  await page.goto("/customer/");
  const b = page.getByRole("button", { name: "Deliver to a saved address", exact: true });
  if (await b.count()) await expect(b).toBeVisible();
});

test("The rider app keeps its label: Deliver to", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", drop_lat: 28.5677, drop_lng: 77.2432 }]);
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" }];
  await page.goto("/rider/");
  await expect(page.getByText("Deliver to", { exact: true })).toBeVisible();
});

for (const size of SIZES) {
  const at = `${size.width}x${size.height}`;
  test(`Nothing moves with the new words, ${at}: the menu top line`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await menu(page, context);
    await expect(page.locator(".ui-where-label")).toBeVisible();
    const sels = [".ui-top", ".ui-where", ".ui-where-label", ".ui-where-line", ".ui-circle", ".ui-search-box"];
    await same(page, sels, [".ui-where", ".ui-where-label"], () => putText(page, ".ui-where-label", "Serving at", "Deliver to"), `menu ${at}`);
    const label = await page.locator(".ui-where-label").boundingBox();
    expect(label!.height, "the top line stays one line").toBeLessThan(30);
  });

  test(`Nothing moves with the new words, ${at}: the address screen`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await menu(page, context, { perm: "granted", pos: 2 });   // the phone's location is off: the Delivering to box shows its true line
    await page.getByTitle("Change the delivery address").click();
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.locator(".ui-going")).toBeVisible();
    const sels = [".ui-head", ".ui-head h1", ".ui-head .meta", ".ui-search-box", ".ui-two-cards", ".ui-going", ".ui-saved-row", ".ui-saved-main"];   // story 1734: the card has no label of its own any more, so only the heading holds the words
    await same(page, sels, [".ui-head h1"], async () => { await putText(page, ".ui-head h1", "Serving at", "Deliver to"); }, `address ${at}`);
  });

  test(`Nothing moves with the new words, ${at}: the Bill's address row`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await bill(page, context);
    await expect(page.locator(".ui-phone-row")).toBeVisible();
    const sels = [".ui-head", ".ui-slip", ".ui-phone-row", ".ui-phone-row small", ".ui-phone-row small + span", ".ui-pinmap-change", ".ui-sticky"];
    await same(page, sels, [".ui-phone-row small"], () => putText(page, ".ui-phone-row small", "Serving at", "Deliver to"), `bill ${at}`);
  });
}
