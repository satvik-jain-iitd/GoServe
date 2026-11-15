// Story 1530 (boards LF4b, LF5, LF6, LF13, LF14): the Deliver to screen. The search box has no arrow, one search for the whole app (the pin map's bar opens it),
// "Recently searched" under the saved list, and nothing moves between the states of the screen.
// A recent is made only by "Confirm & proceed" on a place picked from search. It holds the confirmed point and the customer's own words, never an answer of Ola.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { phoneLoc, setLoc, setup, whereBox } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const AT_HOME = { latitude: 28.5690, longitude: 77.2440 };   // about 150 m from Home
const AWAY = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home
// Story 1548: the place is "Where you are now" only when the phone already holds it (the last address was deleted there). Far from every saved address the box asks, and Deliver to opens from it.
const hereAway = (context: BrowserContext) => context.addInitScript((p) => { window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", p.pin); },
  { address: "Where you are now", pin: "110016", lat: AWAY.latitude, lng: AWAY.longitude, house: "", landmark: "", confirmed: false, id: null });
const anotherAddress = (page: Page) => whereBox(page).getByRole("button", { name: "Use another address" }).click();
const recent = (n: number, over: object = {}) => ({ id: `r${n}`, name: `Road ${n}`, address: `Flat ${n}, Road ${n}`, pin_code: "110016", lat: 28.57 + n / 100, lng: 77.24, house: `Flat ${n}`, landmark: null, used_at: `2026-11-1${n}T10:00:00Z`, ...over });
const FIVE = [1, 2, 3, 4, 5].map((n) => recent(n));
// The stand-in for Ola: a search row and a reverse lookup. Their words must never reach our table.
const OLA_HIT = { name: "Olaname Market", address: "Olaname Market, Olatown, New Delhi", lat: 28.5599, lng: 77.2065, pin: "110016", served: true, from: "ola" };
const OWN_HIT = { name: "Sample Nagar", address: "Sample Nagar, Delhi, 110049", lat: 28.5575, lng: 77.206, pin: "110049", served: true, from: "own" };
const OLA_WORDS = { status: 200, body: { ok: true, address: "Olastreet 9, Olatown, New Delhi", pin: "110016", locality: "Olatown", town: "New Delhi" } };

type Net = Awaited<ReturnType<typeof setup>>;
async function open(page: Page, context: BrowserContext, over: { recents?: object[]; pos?: typeof AT_HOME; hits?: object[]; addresses?: object[] } = {}): Promise<Net> {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = over.addresses ?? [HOME, WORK];
  net.state.recents = over.recents ?? [];
  net.state.places = { status: 200, body: { ok: true, results: over.hits ?? [OLA_HIT] } };
  net.state.geocode = OLA_WORDS;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  if (over.pos) await hereAway(context);
  await phoneLoc(page, { perm: "granted", pos: over.pos ?? AT_HOME });
  await page.goto("/customer/");
  if (over.pos) await anotherAddress(page); else await page.getByTitle("Change the delivery address").click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  return net;
}
const search = (page: Page) => page.getByRole("searchbox", { name: "Search an area or address" });
const places = (page: Page) => page.getByRole("region", { name: "Places" });
const recents = (page: Page) => page.getByRole("region", { name: "Recently searched" });
const pinMap = (page: Page) => page.getByRole("region", { name: "Pin map" });
const details = (page: Page) => page.getByRole("dialog", { name: "Address details" });
async function pick(page: Page, words: string) {
  await search(page).fill(words);
  await places(page).getByRole("button").first().click();
  await expect(pinMap(page)).toBeVisible();
}
async function confirm(page: Page, house: string, landmark = "") {
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await details(page).getByLabel("House, street, colony, ward").fill(house);
  if (landmark) await details(page).getByLabel("Landmark (optional)").fill(landmark);
  await details(page).getByRole("button", { name: "Deliver here" }).click();
}

test("The search box: the magnifier is at the left of the search box and there is no arrow button", async ({ page, context }) => {
  await open(page, context);
  const glass = (await page.locator(".ui-search-box > svg").first().boundingBox())!, input = (await search(page).boundingBox())!;
  expect(glass.x + glass.width).toBeLessThanOrEqual(input.x);
  await expect(page.getByRole("button", { name: "Search places" })).toHaveCount(0);
  await search(page).fill("olaname");
  await search(page).press("Enter");   // Enter still searches at once
  await expect(places(page).getByRole("button")).toHaveCount(1);
});

test("The search box on the pin map: the magnifier is at the left of the words", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  const bar = pinMap(page).getByRole("button", { name: "Search an area or address" });
  const glass = (await bar.locator("svg").boundingBox())!, words = (await bar.locator("span").boundingBox())!;
  expect(glass.x + glass.width).toBeLessThanOrEqual(words.x);
});

test("A search becomes a recent: I pick a place from search and confirm the pin, and it shows first under Recently searched", async ({ page, context }) => {
  const net = await open(page, context, { recents: [recent(1)] });
  net.state.nearPin = "110017";   // our own table's postal code for the point; Ola said 110016
  await pick(page, "green park");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(details(page).getByRole("group", { name: "Save as" })).toHaveCount(0);   // a recent has no label
  await expect(details(page).getByRole("button", { name: "Save address" })).toHaveCount(0);
  await details(page).getByLabel("House, street, colony, ward").fill("12B");
  await details(page).getByLabel("Landmark (optional)").fill("park gate");
  await details(page).getByRole("button", { name: "Deliver here" }).click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();   // the menu, for the confirmed place
  await expect.poll(() => net.state.recents.length).toBe(2);
  const row = net.state.recents.at(-1)!;
  expect(row).toMatchObject({ name: "green park", address: "12B, near park gate, green park", pin_code: "110017", house: "12B", landmark: "park gate" });
  expect(row.lat).toBeCloseTo(OLA_HIT.lat, 3);
  expect(JSON.stringify(net.calls.recentWrites)).not.toMatch(/ola/i);   // no word of Ola's search row or lookup is stored
  expect(net.state.addresses).toHaveLength(2);   // not a saved address
  const place = await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!));
  expect(place).toMatchObject({ confirmed: true, id: null });
  await page.getByTitle("Change the delivery address").click();
  await expect(page.getByText("2 saved")).toBeVisible();   // recents are not counted
  await expect(recents(page).getByRole("listitem").first()).toContainText("green park");
  await expect(recents(page).getByRole("listitem").first()).toContainText("12B, near park gate");
  await expect(recents(page).getByRole("listitem").first()).toContainText("Selected");
  await expect(recents(page).getByRole("listitem")).toHaveCount(2);
});

test("A row of our own postal code table is kept as it is", async ({ page, context }) => {
  const net = await open(page, context, { hits: [OWN_HIT] });
  await pick(page, "sample");
  await confirm(page, "7A");
  await expect.poll(() => net.state.recents.length).toBe(1);
  expect(net.state.recents[0]).toMatchObject({ name: "Sample Nagar", address: "7A, Sample Nagar, Delhi, 110049" });
});

test("A search that was not confirmed never shows in Recently searched", async ({ page, context }) => {
  const net = await open(page, context);
  await pick(page, "green park");
  await pinMap(page).getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await expect(recents(page)).toHaveCount(0);
  expect(net.calls.recentWrites).toHaveLength(0);
});

test("Add new address still saves a named address, not a recent", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Add new address" }).click();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(details(page).getByRole("group", { name: "Save as" })).toBeVisible();
  await details(page).getByLabel("House, street, colony, ward").fill("12B");
  await details(page).getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(3);
  expect(net.calls.recentWrites).toHaveLength(0);
});

test("Three and View all: with 5 recents I see 3, and View all shows the other 2", async ({ page, context }) => {
  await open(page, context, { recents: FIVE });
  await expect(page.getByText("2 saved")).toBeVisible();
  await expect(recents(page).getByRole("heading", { name: "Recently searched" })).toBeVisible();
  const rows = recents(page).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Road 5");   // the newest first
  await expect(rows.first()).toContainText("Flat 5, Road 5");
  await expect(rows.first().locator(".ui-chip-box")).toContainText("km");   // the clock chip carries the distance from the phone
  await expect(recents(page).getByRole("button", { name: /Edit or remove/ })).toHaveCount(0);   // no three-dot menu
  await expect(page.getByRole("button", { name: "View all", exact: true })).toHaveCount(0);   // two saved rows: the saved list has no View all
  const all = page.getByRole("button", { name: "View all recent searches" });
  await expect(all).toHaveText("View all");
  await all.click();
  await expect(rows).toHaveCount(5);
  await expect(all).toHaveCount(0);
});

test("A recent row looks as a saved row: the same card, chip, and row box", async ({ page, context }) => {
  await open(page, context, { recents: FIVE, addresses: [HOME, WORK, { ...WORK, id: "w2", label: "Shop" }] });
  const look = (el: Element) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { w: r.width, h: r.height, bg: s.backgroundColor, radius: s.borderRadius, pad: s.padding }; };
  const savedCard = page.getByRole("region", { name: "Saved addresses" }).locator(".ui-saved-card"), recentCard = recents(page).locator(".ui-saved-card");
  const a = await savedCard.evaluate(look), b = await recentCard.evaluate(look);
  expect({ ...b, h: 0 }).toEqual({ ...a, h: 0 });
  expect(await recentCard.locator(".ui-chip-box").first().evaluate(look)).toEqual(await savedCard.locator(".ui-chip-box").nth(1).evaluate(look));
  expect(await recentCard.getByRole("listitem").first().evaluate(look)).toEqual(await savedCard.getByRole("listitem").nth(1).evaluate(look));   // a saved row in the middle of its list, with no Selected tag
});

test("A tap on a recent picks it as my place, with its confirmed point", async ({ page, context }) => {
  const net = await open(page, context, { recents: FIVE });
  await recents(page).getByRole("button", { name: "Deliver to Road 4" }).click();
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
  const place = await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!));
  expect(place).toMatchObject({ address: "Flat 4, Road 4", pin: "110016", lat: 28.61, lng: 77.24, house: "Flat 4", confirmed: true, id: null });
  await expect.poll(() => net.calls.recentWrites.filter((w) => w.method === "PATCH").length).toBe(1);   // it is now the newest
  expect(net.calls.geocode).toHaveLength(0);   // no call to Ola
});

test("Typing in the search box filters the recents like the saved rows", async ({ page, context }) => {
  await open(page, context, { recents: FIVE, hits: [] });
  await search(page).fill("road 2");
  await expect(recents(page).getByRole("listitem")).toHaveCount(1);
  await expect(recents(page).getByRole("listitem")).toContainText("Road 2");
  await search(page).fill("zzz");
  await expect(recents(page)).toHaveCount(0);
});

test("Recents are not in the sheet's rows and are not the place picked on open", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.recents = FIVE;
  await phoneLoc(page, { perm: "denied", pos: 1 });
  await page.goto("/customer/");
  const sheet = page.getByRole("dialog", { name: "Where to bring your food?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/Road \d/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();   // the saved address used last, never a recent
});

test("One search: the pin map's search bar opens the Deliver to search, and a pick comes back to the pin map at that place", async ({ page, context }) => {
  const net = await open(page, context, { recents: FIVE });
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
  await pinMap(page).getByRole("button", { name: "Search an area or address" }).click();
  await expect(pinMap(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await expect(search(page)).toBeFocused();
  await expect(recents(page)).toBeVisible();   // the saved and the recent rows show there
  await search(page).fill("green park");
  await places(page).getByRole("button").first().click();
  await expect(pinMap(page)).toBeVisible();
  await expect.poll(() => net.calls.serve.at(-1) ?? "").toContain(`lat=${OLA_HIT.lat}`);
  await expect(pinMap(page).getByRole("region", { name: "Places" })).toHaveCount(0);   // the map has no results list of its own
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(details(page).getByRole("group", { name: "Save as" })).toBeVisible();   // it was opened by Add new address: still a saved address
});

for (const how of ["the Back arrow", "the phone's Back button"]) {
  test(`One search: ${how} on the search goes back to the pin map as it was`, async ({ page, context }) => {
    const net = await open(page, context);
    await page.getByRole("button", { name: "Add new address" }).click();
    await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
    const b = (await page.locator(".ui-pinmap-map").boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + 200); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + 120, b.y + 200, { steps: 6 }); await page.mouse.up();
    await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
    const at = new URL(net.calls.serve.at(-1)!).searchParams.get("lat")!;
    const lng = new URL(net.calls.serve.at(-1)!).searchParams.get("lng")!;
    await pinMap(page).getByRole("button", { name: "Search an area or address" }).click();
    await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();   // the one search, not a list over the map
    await expect(search(page)).toBeFocused();
    if (how === "the Back arrow") await page.getByRole("button", { name: "Back" }).click(); else await page.goBack();
    await expect(pinMap(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
    const again = new URL(net.calls.serve.at(-1)!);
    expect(Number(again.searchParams.get("lat"))).toBeCloseTo(Number(at), 4);
    expect(Number(again.searchParams.get("lng"))).toBeCloseTo(Number(lng), 4);   // the pin is where I left it
    await pinMap(page).getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();   // and Back on the map still closes the map
    await expect(search(page)).not.toBeFocused();
  });
}

// Design rule 23: the two states are laid over each other by measure. Each named box of the screen is read in both; only the box that carries the new fact may differ.
type Box = { x: number; y: number; w: number; h: number };
const measure = (page: Page) => page.evaluate(() => {
  const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const scroll = document.querySelector(".ui-deliver-to")!;
  const cent = (v: number) => Math.round(v * 100) / 100;   // a hundredth of a pixel: whole pixels would hide a small move, or show one that is only rounding
  scroll.scrollTop = 0;
  const put = (name: string, el: Element | null) => { if (el) { const r = el.getBoundingClientRect(); out[name] = { x: cent(r.x), y: cent(r.y), w: cent(r.width), h: cent(r.height) }; } };
  put("search", scroll.querySelector(".ui-search-box"));
  scroll.querySelectorAll(".ui-card-btn").forEach((el, i) => put(`card ${i}`, el));
  put("going", scroll.querySelector(".ui-going"));
  for (const [key, label] of [["saved", "Saved addresses"], ["recent", "Recently searched"]]) {
    const s = scroll.querySelector(`section[aria-label="${label}"]`);
    if (!s) continue;
    put(`${key} head`, s.querySelector(".ui-saved-head"));
    put(`${key} card`, s.querySelector(".ui-saved-card"));
    s.querySelectorAll(".ui-saved-row").forEach((el, i) => { put(`${key} row ${i}`, el); put(`${key} chip ${i}`, el.querySelector(".ui-chip-box")); put(`${key} words ${i}`, el.querySelector(".ui-saved-main")); });
    put(`${key} view all`, s.querySelector(".ui-view-all"));
  }
  return out;
});
const lists = (m: Record<string, Box>) => Object.fromEntries(Object.entries(m).filter(([k]) => /^(saved|recent) /.test(k)));
const top = (m: Record<string, Box>) => Object.fromEntries(Object.entries(m).filter(([k]) => /^(search|card)/.test(k)));
const SIX = ["s1", "s2", "s3", "s4"].map((id, i) => ({ ...HOME, id, label: `Place ${i}`, lat: HOME.lat + (i + 1) / 10, last_used_at: `2026-10-0${i + 1}T10:00:00Z` }));

async function state(page: Page, context: BrowserContext, kind: "home" | "away" | "blocked", withRecents: boolean) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK, ...SIX];
  net.state.recents = withRecents ? FIVE : [];
  if (kind === "away") await hereAway(context);
  await phoneLoc(page, kind === "blocked" ? { perm: "denied", pos: 1 } : { perm: "granted", pos: kind === "home" ? AT_HOME : AWAY });
  await page.goto("/customer/");
  if (kind === "blocked") await page.getByRole("dialog", { name: "Where to bring your food?" }).getByRole("button", { name: "View all" }).click();
  else if (kind === "away") await anotherAddress(page);
  else await page.getByTitle("Change the delivery address").click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Saved addresses" }).getByRole("listitem")).toHaveCount(3);
  if (withRecents) await expect(recents(page).getByRole("listitem")).toHaveCount(3);
}

test("Nothing moves: when the location is found or not found only the Delivering to box changes", async ({ browser }) => {
  test.setTimeout(120_000);
  const shot: Record<string, Record<string, Box>> = {};
  for (const kind of ["home", "away", "blocked"] as const) for (const withRecents of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await state(page, context, kind, withRecents);
    const key = `${kind}${withRecents ? "" : " no recents"}`;
    shot[key] = await measure(page);
    if (kind === "blocked" && withRecents) {
      const going = page.getByRole("region", { name: "Delivering to" });
      const card = page.getByRole("button", { name: "Use current location" });
      await expect(going).toContainText("Location is off or blocked");
      for (const [name, pos, words] of [["off", 2, "Your phone's location is off"], ["slow", 3, "Finding you is taking too long"], ["still", 1, "Still off or blocked"]] as const) {
        if (name === "still") { await setLoc(page, { perm: "denied", pos: 1 }); await card.click(); await expect(going).toContainText("Location is off or blocked"); }   // blocked, then blocked again
        await setLoc(page, { perm: "denied", pos });
        await card.click();
        await expect(going).toContainText(words);
        shot[name] = await measure(page);
      }
      await setLoc(page, { perm: "denied", pos: "never" });
      await card.click();
      await expect(page.getByRole("button", { name: "Finding you…" })).toBeDisabled();
      shot.busy = await measure(page);
    }
    await context.close();
  }
  // Found ("Where you are now") against not found, in every cause, and while a find runs: every box is where it was, the Delivering to box included. Only its words differ.
  for (const other of ["blocked", "off", "slow", "still", "busy"]) expect(shot[other], `away against ${other}`).toEqual(shot.away);
  expect(shot["blocked no recents"]).toEqual(shot["away no recents"]);
  // At home (a saved address is picked, so no box: the owner's Way 2) against away: the search and the two cards do not move; the lists keep their size and all sit lower by the one same step.
  for (const tail of ["", " no recents"]) {
    const home = shot[`home${tail}`], away = shot[`away${tail}`];
    expect(home.going).toBeUndefined();
    expect(top(home)).toEqual(top(away));
    const step = away["saved head"].y - home["saved head"].y;
    expect(step).toBeGreaterThanOrEqual(away.going.h);
    expect(Object.fromEntries(Object.entries(lists(home)).map(([k, b]) => [k, { ...b, y: Math.round((b.y + step) * 100) / 100 }]))).toEqual(lists(away));
  }
  // With recents against without: the recents are added under the saved list; nothing above them moves.
  for (const kind of ["home", "away", "blocked"]) {
    const withR = shot[kind], without = shot[`${kind} no recents`];
    expect(Object.keys(without).some((k) => k.startsWith("recent"))).toBe(false);
    expect(withR["recent row 2"]).toBeDefined();
    expect(Object.fromEntries(Object.entries(withR).filter(([k]) => !k.startsWith("recent")))).toEqual(without);
  }
});

// Moved into this layer by the reviewer (15 Nov 2026): six points on the parent layer's screens.
const header = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();
const stored = (context: BrowserContext, place: object) => context.addInitScript((p) => {
  if (window.localStorage.getItem("gs-place")) return;
  window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin);
}, place);

test("A confirmed place that is not a saved address is kept when my phone is at it", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [];   // the save failed, so the place is only on this phone
  await stored(context, { address: "12B, Sample Garden Colony", pin: "110016", lat: HOME.lat, lng: HOME.lng, house: "12B", landmark: "", confirmed: true, id: null });
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });   // about 150 m from it
  await page.goto("/customer/");
  await expect(page.getByRole("searchbox", { name: "Search dishes" })).toBeVisible();
  await expect.poll(() => net.calls.rpc.filter((r: { name?: string } | string) => JSON.stringify(r).includes("address_near_m")).length).toBeGreaterThan(0);   // the open-time find has run
  await page.waitForTimeout(500);
  await expect(page.getByText("Where you are now")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!))).toMatchObject({ address: "12B, Sample Garden Colony", confirmed: true });
});

for (const [name, pos, perm] of [["off", 2, "granted"], ["too slow", 3, "granted"], ["blocked", 1, "denied"]] as const) {
  test(`The sheet, location ${name}: search is the filled last button and the retry is the outline above it`, async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });
    net.state.addresses = [HOME, WORK];
    await phoneLoc(page, { perm, pos });
    await page.goto("/customer/");
    const buttons = page.getByRole("dialog", { name: "Where to bring your food?" }).getByRole("button");
    await expect(buttons.last()).toHaveText("Search your area");
    await expect(buttons.last()).not.toHaveClass(/ghost/);
    await expect(buttons.nth(-2)).toHaveText("Try location again");
    await expect(buttons.nth(-2)).toHaveClass(/ghost/);
  });
}

test("The app does not wait for the phone: with location allowed and a slow phone I see my saved address at once", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await phoneLoc(page, { perm: "granted", pos: "never" });   // the find gives up after 5 s
  await page.goto("/customer/");
  await expect(header(page, /^Home\b/)).toBeVisible({ timeout: 2500 });   // not the loading lines for 5 s
  await expect(page.getByRole("dialog", { name: "Where to bring your food?" })).toBeVisible({ timeout: 8000 });   // then the find's own answer
});

test("No kitchen here, with a saved address: the filled button is last and the screen fits with no scroll", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await stored(context, { address: "Sector 62, Noida, Uttar Pradesh 201301", pin: "110099", lat: 28.62, lng: 77.36, house: "", landmark: "", confirmed: true, id: null });
  await phoneLoc(page, { perm: "denied", pos: 1 });
  await page.goto("/customer/");
  const buttons = page.getByRole("group", { name: "No kitchen here" }).getByRole("button");
  await expect(buttons).toHaveText(["Tell me when you come here", "Deliver to a saved address", "Change location"]);
  await expect(buttons.last()).not.toHaveClass(/ghost/);
  await expect(buttons.first()).toHaveClass(/ghost/);
  const fits = await buttons.last().evaluate((el) => {
    const r = el.getBoundingClientRect();
    let ok = r.bottom <= window.innerHeight && r.top >= 0;
    for (let p = el.parentElement; p; p = p.parentElement) ok = ok && p.scrollHeight <= p.clientHeight + 1;
    return ok;
  });
  expect(fits).toBe(true);
});

test("While I type in the search only the results show: the two cards and the Delivering to box are not above them", async ({ page, context }) => {
  await open(page, context, { recents: FIVE, pos: AWAY });
  const cards = page.locator(".ui-two-cards"), going = page.getByRole("region", { name: "Delivering to" });
  await expect(cards).toBeVisible();
  await expect(going).toBeVisible();
  await search(page).fill("green");
  await expect(places(page).getByRole("button")).toHaveCount(1);
  await expect(cards).toHaveCount(0);
  await expect(going).toHaveCount(0);
  const box = (await page.locator(".ui-search-box").boundingBox())!, first = (await page.getByRole("region", { name: "Saved addresses" }).boundingBox())!;
  expect(first.y - (box.y + box.height)).toBeLessThanOrEqual(24);   // the results start right under the search box
  await search(page).fill("");
  await expect(cards).toBeVisible();
  await expect(going).toBeVisible();
});
