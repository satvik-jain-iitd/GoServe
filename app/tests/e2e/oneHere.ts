// Story 1608 (owner, 17 Nov 2026): on Deliver to one row says "here", the nearest saved address inside the near distance (the setting address_near_m, 100 m).
// Every other row keeps its own icon and says how far it is (metres under 1 km). The here row is first, then last used. Two rows show, then View all, for the saved
// addresses and for the recent searches. The order is set when the screen opens and after "Use current location"; it does not jump while the list is open (rule 23).
// The pick on open uses the same rule (hereRow in lib/addresses.ts; its cases are in tests/unit/addresses.test.ts). Run by Chromium (one-here.spec.ts) and by WebKit (one-here.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { answeredAt, comeBack, phoneLoc, setLoc, setup, toDeliverTo, whereBox, type Loc } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PHONE = { latitude: 28.5677, longitude: 77.2432 };
const north = (m: number) => PHONE.latitude + m / 111_195;   // m metres north of the phone
const row = (id: string, label: string, m: number, day: number) => ({ id, label, address: `${label} house, Sample Garden Colony, Sampletown`, pin_code: "110016", lat: north(m), lng: PHONE.longitude, last_used_at: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z` });
const placeOf = (r: ReturnType<typeof row>) => ({ address: r.address, pin: r.pin_code, lat: r.lat, lng: r.lng, house: "", landmark: "", confirmed: true, id: r.id });
const ARROW = 'path[d="M21 3L3 11l7 3 3 7z"]', HOUSE = 'path[d="M4 11l8-7 8 7"]', CASE = "rect", PIN = "circle";   // the icons of DeliverToScreen: the here arrow, Home, Office, any other label

// place: the place this phone holds (none: the pick on open decides). quiet: the customer answered the box "Where should we deliver?" at this spot today, so it does not come up.
async function open(context: BrowserContext, page: Page, rows: object[], pos: Loc["pos"], { place, recents = [] as object[], quiet = false }: { place?: object; recents?: object[]; quiet?: boolean } = {}) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = rows; net.state.recents = recents;
  net.state.geocode = { status: 200, body: { ok: true, address: "Sample Garden Colony, Sampletown", pin: "110016", locality: "Sampletown", town: "Sampletown" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  if (place) await context.addInitScript((p) => { if (!window.localStorage.getItem("gs-place")) { window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin); } }, place);
  if (quiet && typeof pos === "object") await answeredAt(context, pos);
  await phoneLoc(page, { perm: "granted", pos });
  await page.goto("/customer/");
  return net;
}
const saved = (page: Page) => page.getByRole("region", { name: "Saved addresses" }).getByRole("listitem");
const recents = (page: Page) => page.getByRole("region", { name: "Recently searched" }).getByRole("listitem");
const chip = (li: ReturnType<typeof saved>) => li.locator(".ui-chip-box");
const labels = (page: Page) => saved(page).locator(".ui-saved-label > span:first-child").allTextContents();
const tops = (page: Page) => saved(page).evaluateAll((els) => els.map((el) => { const b = el.getBoundingClientRect(); return `${el.querySelector(".ui-saved-label > span")!.textContent} at ${Math.round(b.top)}, ${Math.round(b.height)} high`; }));

export function oneHere() {
  test("Three saved addresses inside 100 m: one row says here (the nearest), it is first, and the other two keep their own icon and say metres", async ({ page, context }) => {
    await open(context, page, [row("h1", "Home", 60, 9), row("o1", "Office", 30, 5), row("g1", "Gym", 90, 1)], PHONE);
    await expect(page.getByTitle("Change the delivery address")).toContainText("Office");   // the pick on open is the same row
    await toDeliverTo(page);
    await expect(saved(page)).toHaveCount(2);   // two rows, then View all
    await page.getByRole("button", { name: "View all", exact: true }).click();
    await expect(saved(page)).toHaveCount(3);
    expect(await labels(page)).toEqual(["Office", "Home", "Gym"]);   // the here row, then last used
    await expect(chip(saved(page).nth(0))).toHaveText("here");
    await expect(chip(saved(page).nth(1))).toHaveText("60 m");
    await expect(chip(saved(page).nth(2))).toHaveText("90 m");
    await expect(page.getByRole("region", { name: "Saved addresses" }).locator(ARROW)).toHaveCount(1);
    await expect(chip(saved(page).nth(0)).locator(ARROW)).toHaveCount(1);
    await expect(chip(saved(page).nth(1)).locator(HOUSE)).toHaveCount(1);   // Home keeps its house
    await expect(chip(saved(page).nth(2)).locator(PIN)).toHaveCount(1);   // any other label keeps its pin
    await expect(page.getByText("here", { exact: true })).toHaveCount(1);
  });

  test("130 m from Home with a fix 50 m rough: Home is picked on open and is the here row", async ({ page, context }) => {
    await open(context, page, [row("h1", "Home", 130, 5)], { ...PHONE, accuracy: 50 });
    await expect(page.getByTitle("Change the delivery address")).toContainText("Home");
    await expect(whereBox(page)).toHaveCount(0);
    await toDeliverTo(page);
    await expect(chip(saved(page).first())).toHaveText("here");
    await expect(chip(saved(page).first()).locator(ARROW)).toHaveCount(1);
  });

  test("250 m from Home with a fix 500 m rough: Home is not the here row, it keeps its house and says 250 m", async ({ page, context }) => {
    const home = row("h1", "Home", 250, 5);
    await open(context, page, [home], { ...PHONE, accuracy: 500 }, { place: placeOf(home) });
    await toDeliverTo(page);
    await expect(chip(saved(page).first())).toHaveText("250 m");
    await expect(chip(saved(page).first()).locator(HOUSE)).toHaveCount(1);
    await expect(page.locator(ARROW)).toHaveCount(0);
  });

  test("No saved address inside 100 m: no row says here, each keeps its icon, and the rows are in last-used order", async ({ page, context }) => {
    const home = row("h1", "Home", 150, 1), office = row("o1", "Office", 8_000, 9);
    await open(context, page, [office, home], PHONE, { place: placeOf(home), quiet: true });
    await toDeliverTo(page);
    expect(await labels(page)).toEqual(["Office", "Home"]);
    await expect(chip(saved(page).nth(0))).toHaveText("8 km");
    await expect(chip(saved(page).nth(0)).locator(CASE)).toHaveCount(1);
    await expect(chip(saved(page).nth(1))).toHaveText("150 m");
    await expect(chip(saved(page).nth(1)).locator(HOUSE)).toHaveCount(1);
    await expect(page.locator(ARROW)).toHaveCount(0);
    await expect(page.getByText("here", { exact: true })).toHaveCount(0);
  });

  test("Four saved addresses and four recent searches: two rows of each show, and View all shows all four", async ({ page, context }) => {
    const rows = [row("h1", "Home", 0, 9), row("o1", "Office", 3_000, 7), row("p1", "Parents", 5_000, 5), row("g1", "Gym", 7_000, 3)];
    const recent = (n: number) => ({ id: `r${n}`, name: `Road ${n}`, address: `Flat ${n}, Road ${n}`, pin_code: "110016", lat: north(n * 50), lng: PHONE.longitude, house: `Flat ${n}`, landmark: null, used_at: `2026-11-1${n}T10:00:00Z` });
    await open(context, page, rows, PHONE, { recents: [4, 3, 2, 1].map(recent) });
    await toDeliverTo(page);
    await expect(page.getByText("4 saved")).toBeVisible();
    await expect(saved(page)).toHaveCount(2);
    await page.getByRole("button", { name: "View all", exact: true }).click();
    await expect(saved(page)).toHaveCount(4);
    await expect(page.getByRole("button", { name: "View all", exact: true })).toHaveCount(0);
    await expect(recents(page)).toHaveCount(2);
    await expect(chip(recents(page).first())).toHaveText("200 m");   // a recent says how far it is too, and never "here"
    await page.getByRole("button", { name: "View all recent searches" }).click();
    await expect(recents(page)).toHaveCount(4);
    await expect(chip(recents(page).last())).toHaveText("50 m");
    await expect(page.getByText("here", { exact: true })).toHaveCount(1);   // Home only
  });

  test("The order does not jump while the list is open: the phone moves to Office, no row changes place; after Use current location the list opens with Office first", async ({ page, context }) => {
    const home = row("h1", "Home", 0, 5), office = row("o1", "Office", 300, 9);
    await open(context, page, [office, home], PHONE);
    await toDeliverTo(page);
    expect(await labels(page)).toEqual(["Home", "Office"]);   // the here row first, though Office was used last
    await expect(chip(saved(page).nth(0))).toHaveText("here");
    await expect(chip(saved(page).nth(1))).toHaveText("300 m");
    const before = await tops(page);
    const atOffice = { latitude: office.lat, longitude: office.lng };
    await setLoc(page, { perm: "granted", pos: atOffice });
    await comeBack(page);   // the phone is read again with the list open
    await expect(chip(saved(page).nth(1))).toHaveText("here");   // the mark is true for where the phone is now
    await expect(chip(saved(page).nth(0))).toHaveText("300 m");
    expect(await tops(page)).toEqual(before);   // rule 23: every row where it was
    await page.getByRole("button", { name: "Use current location" }).click();   // the tap: the map opens at the phone
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Serving at", exact: true, level: 1 })).toBeVisible();
    expect(await labels(page)).toEqual(["Office", "Home"]);
    await expect(chip(saved(page).nth(0))).toHaveText("here");
  });

  test("the here row is never hidden: the phone is found after the screen opened, and the here row is the third saved address", async ({ page, context }) => {
    await open(context, page, [row("g1", "Gym", 700, 9), row("h1", "Home", 650, 8), row("o1", "Office", 30, 1)], "never");   // the find on open waits and fails: slow
    await toDeliverTo(page);
    await expect(saved(page).first()).toBeVisible();
    await setLoc(page, { perm: "granted", pos: PHONE });
    await comeBack(page);   // the phone is found now, with no tap
    await expect(chip(saved(page).first())).toHaveText("here");   // the here row is in the short list, not behind View all
    await expect(saved(page)).toHaveCount(2);
    expect((await labels(page))[0]).toBe("Office");
  });
}
