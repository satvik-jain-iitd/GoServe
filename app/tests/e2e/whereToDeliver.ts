// Story 1548 (owner, 15 Nov 2026): the phone is not near any saved address and not near any place this customer confirmed before. The app stops him with one box,
// "Where should we deliver?", and two answers. He cannot go on until he picks one. The place never changes by itself to "Where you are now".
// One list of scenarios, run by Chromium (where-to-deliver.spec.ts) and by WebKit, the iPhone engine (where-to-deliver.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { asked, comeBack, order, phoneLoc, setLoc, setup, type Loc } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const AWAY = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home
const AWAY_2 = { latitude: 28.70, longitude: 77.10 };   // far from Home and from AWAY
const HALF_KM = { latitude: 28.5722, longitude: 77.2432 };   // about 500 m from Home
const TITLE = "Where should we deliver?";
const NOT_YET = "We do not deliver here yet";
const box = (page: Page) => page.getByRole("dialog", { name: TITLE });
const other = (page: Page) => box(page).getByRole("button", { name: "Use another address" });
const current = (page: Page) => box(page).getByRole("button", { name: "Use current location" });
const header = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();
const menuOfHome = async (page: Page) => { await expect(header(page, /^Home\b/)).toBeVisible(); await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible(); };
const quiet = async (page: Page, ms = 700) => { await page.waitForTimeout(ms); await expect(page.getByRole("dialog")).toHaveCount(0); };   // the open is over and nothing came up
const placeOf = (row: typeof HOME) => ({ address: row.address, pin: row.pin_code, lat: row.lat, lng: row.lng, house: "", landmark: "", confirmed: true, id: row.id as string | null });
const rowAt = (id: string, label: string, at: { latitude: number; longitude: number }) => ({ ...HOME, id, label, address: `${label}, Sample Road, Sampletown`, lat: at.latitude, lng: at.longitude, last_used_at: "2026-11-01T10:00:00Z" });

type Net = Awaited<ReturnType<typeof setup>>;
type Opts = { rows?: object[]; place?: object; draft?: object; orders?: object[]; before?: (net: Net) => void };
// This phone holds Home, picked on an earlier open. The phone's place is `loc`.
async function open(context: BrowserContext, page: Page, loc: Loc, { rows = [HOME], place = placeOf(HOME), draft, orders = [], before }: Opts = {}) {
  const net = await setup(context, page, orders, { pin: null });
  net.state.addresses = rows;
  before?.(net);
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.addInitScript(([p, d]) => {
    if (window.localStorage.getItem("gs-place")) return;   // only when nothing is there, so a second open keeps what the app wrote
    window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin);
    if (d) window.localStorage.setItem("gs-draft", JSON.stringify(d));
  }, [place, draft ?? null] as const);
  await phoneLoc(page, loc);
  await page.goto("/customer/");
  return net;
}
// Every call to a map service: the geocode, the place search, the can-we-serve check, OpenStreetMap and the map tiles.
const mapCalls = (page: Page) => { const seen: string[] = []; page.on("request", (r) => { if (/functions\/v1\/(geocode|place-search|serviceability)|nominatim|tiles\.test/.test(r.url())) seen.push(new URL(r.url()).pathname); }); return seen; };
// Every point of a grid over the whole screen that does NOT hit the box or its cover.
const holes = (page: Page) => page.evaluate(() => {
  const w = window.innerWidth, h = window.innerHeight, out: string[] = [];
  for (let y = 1; y < h; y += Math.round(h / 24)) for (const x of [1, Math.round(w / 4), Math.round(w / 2), Math.round(3 * w / 4), w - 2]) {
    const el = document.elementFromPoint(x, y);
    if (!el?.closest(".ui-sheet-back")) out.push(`(${x}, ${y}) hits ${el ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}` : "nothing"}`);
  }
  for (const x of [1, Math.round(w / 2), w - 2]) { const el = document.elementFromPoint(x, h - 1); if (!el?.closest(".ui-sheet-back")) out.push(`(${x}, ${h - 1}), the last pixel row, is not the box`); }
  return out;
});
// The box and each of its parts, by measure in the browser: "name WxH at x,y".
const measure = (page: Page) => page.evaluate(() => [".ui-sheet-back .ui-sheet", ".ui-sheet-back h2", ".ui-sheet-back .ui-btn.ghost", ".ui-sheet-back .ui-btn:not(.ghost)", ".ui-sheet-back [role=status]"].map((s) => {
  const r = document.querySelector(s)!.getBoundingClientRect();
  return `${s} ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}`;
}));
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));   // the box has come up
const pickHome = async (page: Page) => { await other(page).click(); await page.getByRole("button", { name: "Serve at Home" }).click(); await menuOfHome(page); };

export function whereToDeliver() {
  test("Not near any saved address: I open the app, I see the box with its two answers, I cannot reach the menu, and no map service was called", async ({ page, context }) => {
    const maps = mapCalls(page);
    const net = await open(context, page, { perm: "granted", pos: AWAY }, { draft: { step: "menu", cart: {}, address: HOME.address, name: "", phone: "" } });
    await expect(box(page)).toBeVisible();
    await expect(box(page).getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(current(page)).toBeEnabled();
    await expect(box(page).getByRole("button")).toHaveText(["Use another address", "Use current location"]);   // only these two, the outline one above, the filled one last
    await expect(box(page).getByText(NOT_YET)).toHaveCount(0);
    await settled(page);
    const [a, b] = [await other(page).boundingBox(), await current(page).boundingBox()];
    expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
    expect(await other(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);   // outline
    expect(await current(page).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);   // filled
    // The place did not change by itself, and no place was saved.
    await expect(header(page, /^Home\b/)).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!).id)).toBe("h1");
    expect(net.calls.addressWrites.filter((w) => w.method === "POST")).toHaveLength(0);
    // I cannot reach the menu: every point of the screen is the box or its cover, a tap where a dish is adds nothing, and the keyboard stays in the box.
    expect(await holes(page)).toEqual([]);
    const add = (await page.getByRole("button", { name: "Add Butter Chicken" }).boundingBox())!;
    await page.mouse.click(add.x + add.width / 2, add.y + add.height / 2);
    await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
    for (let n = 0; n < 8; n++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => { const el = document.activeElement; return !el || el === document.body || !!el.closest("[role=dialog]"); }), "the focus left the box").toBe(true);
    }
    await expect(box(page)).toBeVisible();
    // No map service was called: not by the open, not by the box.
    expect(maps).toEqual([]);
    expect([net.calls.geocode.length, net.calls.places.length, net.calls.serve.length]).toEqual([0, 0, 0]);
    expect(await asked(page)).toBe(1);   // one read of the phone's place, with no ask (the permission was given before)
  });

  test("The box cannot be passed: I tap outside the box, press Escape, swipe it and press Back, and the box stays", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await settled(page);
    await expect(box(page).getByRole("button", { name: /close/i })).toHaveCount(0);   // no close button
    await page.mouse.click(20, 20);   // outside the box, on the cover
    await expect(box(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(box(page)).toBeVisible();
    const t = (await box(page).getByRole("heading").boundingBox())!;
    await page.mouse.move(t.x + 40, t.y + 10); await page.mouse.down(); await page.mouse.move(t.x + 40, t.y + 400, { steps: 8 }); await page.mouse.up();   // a swipe down on the box
    await expect(box(page)).toBeVisible();
    expect(await holes(page)).toEqual([]);
    // The phone's Back button does what it does on the menu: the box added no step of its own, so Back leaves the app. Back in the app, the box is there.
    expect(await page.evaluate(() => !!(window.history.state as { gsSheet?: boolean } | null)?.gsSheet)).toBe(false);
    await page.goBack();
    await expect(page).not.toHaveURL(/customer/);
    await page.goForward();
    await expect(box(page)).toBeVisible();
  });

  test("Use current location: the pin map opens on where I am, an address is read only when I confirm, and after the details that place is my delivery place", async ({ page, context }) => {
    const net = await open(context, page, { perm: "granted", pos: AWAY }, { before: (n) => { n.state.geocode = { status: 200, body: { ok: true, address: "Sample Nagar, Sampletown, Sample State", pin: "110016", locality: "Sample Nagar", town: "Sampletown" } }; } });
    await current(page).click();
    await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
    await expect(box(page)).toHaveCount(0);
    const confirm = page.getByRole("button", { name: "Confirm & proceed" });
    await expect(confirm).toBeEnabled();
    expect(net.calls.geocode).toHaveLength(0);   // no address is read while the pin rests
    await confirm.click();
    await expect.poll(() => net.calls.geocode.length).toBe(1);   // the address is read on Confirm, at the phone's place
    const at = new URL(net.calls.geocode[0]).searchParams;
    expect(Math.abs(Number(at.get("lat")) - AWAY.latitude)).toBeLessThan(0.002);
    expect(Math.abs(Number(at.get("lng")) - AWAY.longitude)).toBeLessThan(0.002);
    await page.getByLabel("House, street, colony, ward").fill("Z-1, ground floor");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
    await expect(box(page)).toHaveCount(0);
    const saved = net.calls.addressWrites.filter((w) => w.method === "POST");
    expect(saved).toHaveLength(1);   // saved as that flow saves it today
    expect(Math.abs(saved[0].body.lat - AWAY.latitude)).toBeLessThan(0.002);
    const place = await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!));
    expect(place).toMatchObject({ confirmed: true, id: "a2" });
    expect(Math.abs(place.lat - AWAY.latitude)).toBeLessThan(0.002);
    await page.reload();   // at that place the app never asks again
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
    await quiet(page);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!).id)).toBe("a2");
  });

  test("I back out: I tap an answer and come back without setting a place, and the box shows again", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await current(page).click();
    await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();   // before Confirm
    await expect(box(page)).toBeVisible();
    await other(page).click();
    await expect(page.getByRole("heading", { name: "Serving at", exact: true, level: 1 })).toBeVisible();
    await expect(box(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Back", exact: true }).click();   // nothing chosen
    await expect(box(page)).toBeVisible();
    await other(page).click();
    await expect(page.getByRole("heading", { name: "Serving at", exact: true, level: 1 })).toBeVisible();
    await page.goBack();   // the phone's Back button, nothing chosen
    await expect(box(page)).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!).id)).toBe("h1");   // the place stayed
  });

  test("Use another address: I pick a saved address, I see the menu for that address, and the box does not show again at this spot today", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await pickHome(page);
    await expect(box(page)).toHaveCount(0);
    for (let n = 0; n < 2; n++) {   // the next opens at this spot, the same day
      await page.reload();
      await menuOfHome(page);
      await quiet(page);
    }
    await comeBack(page);   // and on coming back to the app
    await quiet(page);
  });

  test("Coming back to the app at a new spot far from every saved address: the box shows, with no reload", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: { latitude: HOME.lat, longitude: HOME.lng } });
    await menuOfHome(page);
    await quiet(page);
    await setLoc(page, { perm: "granted", pos: AWAY });   // the customer went to a friend's house with the app open
    await comeBack(page);
    await expect(box(page)).toBeVisible();
    await expect(header(page, /^Home\b/)).toBeVisible();
    await setLoc(page, { perm: "granted", pos: { latitude: HOME.lat, longitude: HOME.lng } });   // and home again, with the box not answered: nothing is left to ask
    await comeBack(page);
    await expect(box(page)).toHaveCount(0);
    await menuOfHome(page);
  });

  test("The next day: I picked a saved address at this spot yesterday, I open the app at the same spot, and the box shows once", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await pickHome(page);
    await page.reload();
    await menuOfHome(page);
    await quiet(page);   // today: no box
    await page.evaluate(() => {   // the phone's own memory, moved one day back: the answer was given yesterday
      const key = Object.keys(localStorage).find((k) => /asked/.test(k) && k !== "gs_alerts_asked")!;
      const list = JSON.parse(localStorage.getItem(key)!) as { at: number; day: string }[];
      const d = new Date(Date.now() - 86_400_000);
      localStorage.setItem(key, JSON.stringify(list.map((s) => ({ ...s, at: s.at - 86_400_000, day: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }))));
    });
    await page.reload();
    await expect(box(page)).toBeVisible();   // the next day: once more
    await pickHome(page);
    await page.reload();
    await menuOfHome(page);
    await quiet(page);   // and only once
  });

  test("A place set here: I set my delivery place at this spot before, I open the app at the same spot, and that place is picked with no word and no box", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY }, { rows: [HOME, rowAt("f1", "Friend", AWAY)] });
    await expect(header(page, /^Friend\b/)).toBeVisible();   // the saved address the phone is at
    await quiet(page);
  });

  test("T14: A place confirmed here before, from search (a recent, confirmed true): no box shows and my place stays", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY }, { before: (n) => { n.state.recents = [{ id: "r1", name: "Sample Mall", address: "Sample Mall, Sampletown", pin_code: "110016", lat: AWAY.latitude, lng: AWAY.longitude, house: null, landmark: null, used_at: "2026-11-10T10:00:00Z", confirmed: true }]; } });
    await menuOfHome(page);
    await quiet(page);
  });

  test("T13: A place only tapped in search (a recent, confirmed false) is not a known place: the box shows and my place stays", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY }, { before: (n) => { n.state.recents = [{ id: "r1", name: "Sample Mall", address: "Sample Mall, Sampletown", pin_code: "110016", lat: AWAY.latitude, lng: AWAY.longitude, house: null, landmark: null, used_at: "2026-11-10T10:00:00Z", confirmed: false }]; } });
    await expect(box(page)).toBeVisible();
    await expect(box(page).getByRole("heading", { name: TITLE })).toBeVisible();
    await settled(page);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!).id)).toBe("h1");
  });

  test("We do not deliver here: Use current location is greyed with the line under it, Use another address works, and the box has the same height as when we do deliver", async ({ page, context }) => {
    const maps = mapCalls(page);
    const net = await open(context, page, { perm: "granted", pos: AWAY });
    await expect(current(page)).toBeEnabled();
    await settled(page);
    const served = await measure(page);
    net.state.nearPin = "110099";   // no kitchen serves the place the phone is at
    await page.reload();
    await expect(box(page)).toBeVisible();
    await expect(current(page)).toBeDisabled();
    await expect(box(page).getByRole("status")).toHaveText(NOT_YET);
    await settled(page);
    const [b, l] = [await current(page).boundingBox(), await box(page).getByRole("status").boundingBox()];
    expect(b!.y + b!.height, "the line is under the filled button").toBeLessThanOrEqual(l!.y);
    expect(await measure(page)).toEqual(served);   // rule 23: every part of the box is where it was, at the same size
    const mid = { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
    await page.mouse.click(mid.x, mid.y);   // a tap on the greyed button does nothing
    await expect(box(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "Pin map" })).toHaveCount(0);
    expect(maps).toEqual([]);   // our own kitchens table answered, no map service
    await pickHome(page);   // Use another address works
  });

  test("The kitchens cannot be read (a bad network): Use current location stays open, and the pin map says what is true", async ({ page, context }) => {
    await context.route("**/rest/v1/kitchens*", (r) => r.abort("internetdisconnected"));
    await open(context, page, { perm: "granted", pos: AWAY }, { place: { ...placeOf(HOME) } });
    await expect(box(page)).toBeVisible();
    await expect(current(page)).toBeEnabled();
    await expect(box(page).getByText(NOT_YET)).toHaveCount(0);
  });

  for (const [name, pos] of [["rougher than 1000 m", { ...AWAY, accuracy: 1500 }], ["500 m from Home, and rough by 450 m: treated as near Home", { ...HALF_KM, accuracy: 450 }]   /* story 1608: near is 100 m (it was 200), so 400 m of roughness no longer reaches Home */] as const) {
    test(`A rough place (${name}): no box shows, and my place stays`, async ({ page, context }) => {
      await open(context, page, { perm: "granted", pos });
      await menuOfHome(page);
      await quiet(page);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gs-place")!).id)).toBe("h1");
    });
  }
  test("A place that is good enough (500 m from Home, right to 50 m): the box shows", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: { ...HALF_KM, accuracy: 50 } });
    await expect(box(page)).toBeVisible();
  });

  const CANNOT: [string, Loc][] = [["off", { perm: "granted", pos: 2 }], ["blocked", { perm: "denied", pos: 1 }], ["never asked", { perm: "prompt", pos: "never" }], ["never asked, on an iPhone that cannot say so", { perm: null, pos: "never" }]];
  for (const [name, loc] of CANNOT) {
    test(`The phone's place cannot be read (${name}): no box shows and my place stays`, async ({ page, context }) => {
      await open(context, page, loc);
      await menuOfHome(page);
      await quiet(page);
      if (loc.perm !== "granted") expect(await asked(page)).toBe(0);   // the phone is never asked for its place on an open
    });
  }

  test("An order is on its way: I have an order in progress, and no box shows, on the tracker or back on the menu", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY }, { orders: [order("preparing", "2020-01-01T10:02:00Z")] });
    await expect(page.getByRole("searchbox", { name: "Search dishes" })).toHaveCount(0);   // the tracker opened, not the menu
    await expect.poll(() => asked(page)).toBe(1);   // the phone was found, far from Home
    await quiet(page);
    await page.goBack();   // to the menu, with the order still on its way
    await menuOfHome(page);
    await quiet(page);
  });

  test("One box for everyone: a customer with 1 saved address and one with 20 see a box of the same size, and it names no address", async ({ page, context }) => {
    const net = await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await settled(page);
    const one = await measure(page);
    net.state.addresses = [HOME, ...Array.from({ length: 19 }, (_, i) => rowAt(`s${i}`, `Sample place ${i + 1}`, { latitude: 27 + i / 10, longitude: 76 }))];
    await page.reload();
    await expect(box(page)).toBeVisible();
    await settled(page);
    expect(await measure(page)).toEqual(one);
    const words = (await box(page).innerText()).replace(/\s+/g, " ").trim();
    expect(words).toBe(`${TITLE} Use another address Use current location`);   // no address name, no other word
    await other(page).click();
    await expect(page.getByText("20 saved")).toBeVisible();   // the 20 were there
  });

  test("A moving vehicle: I answer with another address while the phone moves fast, and the box does not show at the next spot; standing still, it does", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: { ...AWAY, speed: 12 } });
    await pickHome(page);
    await setLoc(page, { perm: "granted", pos: { ...AWAY_2, speed: 12 } });   // on the road, another spot
    await comeBack(page);
    await quiet(page);
    await page.evaluate(() => {   // the answer was given more than 3 hours ago
      const key = Object.keys(localStorage).find((k) => /asked/.test(k) && k !== "gs_alerts_asked")!;
      localStorage.setItem(key, JSON.stringify((JSON.parse(localStorage.getItem(key)!) as { at: number }[]).map((s) => ({ ...s, at: s.at - 3 * 3600_000 - 1000 }))));
    });
    await comeBack(page);
    await expect(box(page)).toBeVisible();
  });
  test("No speed from the phone: an answer holds only at its own spot", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: { ...AWAY, speed: null } });
    await pickHome(page);
    await setLoc(page, { perm: "granted", pos: { ...AWAY_2, speed: null } });
    await comeBack(page);
    await expect(box(page)).toBeVisible();
  });

  test("I tap Use my current location on the sheet, far from every saved address: the pin map opens at once on where I am, and the box does not ask a second time", async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });   // a phone that holds no place, never asked for its location
    net.state.addresses = [HOME];
    await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await phoneLoc(page, { perm: "prompt", pos: AWAY });
    await page.goto("/customer/");
    const sheet = page.getByRole("dialog", { name: "Where to bring your food?" });
    await sheet.getByRole("button", { name: "Use my current location" }).click();   // he has chosen: the phone asks, and finds him 6 km from Home
    await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);   // no box, no sheet
    await expect.poll(() => net.calls.serve.at(-1) ?? "").toContain(`lat=${AWAY.latitude}`);   // the pin is on the phone's place
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await menuOfHome(page);   // the address used last stays
    await quiet(page);
  });

  test("I tap Use current location on Deliver to, far from every saved address: the pin map opens at once, with no box", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await other(page).click();
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("The postal code of where I am cannot be read (a bad network): Use current location stays open, with no line", async ({ page, context }) => {
    await page.route("**/rest/v1/rpc/nearest_pin", (r) => r.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));   // a page route wins over the helper's
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await expect(current(page)).toBeEnabled();
    await expect(box(page).getByText(NOT_YET)).toHaveCount(0);
  });

  test("A cart that meets another kitchen (story 1540): I use my current location with a dish on the bill, another kitchen serves that place, and the menu says the kitchen changed", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY }, {
      draft: { step: "menu", cart: { d1: 1 }, address: HOME.address, name: "", phone: "" },
      before: (n) => {
        n.state.nearPin = "110017";
        n.state.geocode = { status: 200, body: { ok: true, address: "Sample Nagar, Sampletown, Sample State", pin: "110017", locality: "Sample Nagar", town: "Sampletown" } };
        const kitchens = n.state.kitchens as { id: string; name: string; pin_codes: string[] }[];
        kitchens.push({ ...kitchens[0], id: "k-2", name: "Sample Nagar Kitchen", pin_codes: ["110017"] });   // it makes the same dish: the cart moves to it, with a word
        n.state.serve = { status: 200, body: { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-2", name: "Sample Nagar Kitchen", distance_m: 900, eta_min: 25, open: true }] } };
      },
    });
    await expect(current(page)).toBeEnabled();   // a kitchen of ours serves where I am
    await current(page).click();
    await page.getByRole("button", { name: "Confirm & proceed" }).click();
    await page.getByLabel("House, street, colony, ward").fill("Z-1, ground floor");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.locator(".ui-greet-line[role=status]")).toHaveText("The kitchen changed. See your bill.");
    await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();   // the bill was not lost
    await expect(box(page)).toHaveCount(0);
  });

  test("A rough read on coming back (right to 1500 m only): the box I have not answered stays", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await setLoc(page, { perm: "granted", pos: { ...AWAY, accuracy: 1500 } });   // indoors, after another app
    await comeBack(page);
    await page.waitForTimeout(700);
    await expect(box(page)).toBeVisible();
    await expect(current(page)).toBeEnabled();
  });

  test("At Home with a bad network: my saved addresses and my recent places cannot be read, and no box stops me at my own place", async ({ page, context }) => {
    for (const path of ["**/rest/v1/addresses*", "**/rest/v1/recent_places*"]) await page.route(path, (r) => r.fulfill({ status: 500, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));   // a page route wins over the helper's
    await open(context, page, { perm: "granted", pos: { latitude: HOME.lat, longitude: HOME.lng } });
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the menu of the place this phone holds
    await quiet(page, 1200);
    await comeBack(page);
    await quiet(page);
    await expect(page.getByText(HOME.address).first()).toBeVisible();   // and the place did not change
  });

  test("A rough read at a spot I answered for: I come back 300 m away, right to 400 m only, and the box does not show again", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await pickHome(page);
    await setLoc(page, { perm: "granted", pos: { latitude: AWAY.latitude + 0.0027, longitude: AWAY.longitude, accuracy: 400 } });   // the same house, a coarse fix
    await comeBack(page);
    await quiet(page);
    await setLoc(page, { perm: "granted", pos: { latitude: AWAY.latitude + 0.0027, longitude: AWAY.longitude, accuracy: 20 } });   // a good fix 300 m away is another spot
    await comeBack(page);
    await expect(box(page)).toBeVisible();
  });

  test("A screen reader is told: when the box comes up the focus is on its title, and it stays in the box", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page).getByRole("heading", { name: TITLE })).toBeFocused();
    expect(await box(page).getByRole("heading", { name: TITLE }).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");   // a title shows no ring
    await page.keyboard.press("Tab");   // WebKit does not tab to buttons by default, so only "not out of the box" is asked here
    expect(await page.evaluate(() => { const el = document.activeElement; return !el || el === document.body || !!el.closest("[role=dialog]"); })).toBe(true);
  });

  test("The box is up and I come back at the same spot: our postal code table and our kitchens are not read again", async ({ page, context }) => {
    let reads = 0;
    page.on("request", (r) => { if (/rpc\/nearest_pin|rest\/v1\/kitchens/.test(r.url())) reads++; });
    await open(context, page, { perm: "granted", pos: AWAY });
    await expect(box(page)).toBeVisible();
    await page.waitForTimeout(500);
    const before = reads;
    expect(before).toBeGreaterThan(0);
    await comeBack(page);
    await page.waitForTimeout(700);
    expect(reads).toBe(before);
    await expect(box(page)).toBeVisible();
  });

  test("Story 1547 holds: with no place on this phone and the phone not found, the sheet Where to bring your food? shows, not the box", async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });
    net.state.addresses = [HOME];
    await phoneLoc(page, { perm: "denied", pos: 1 });
    await page.goto("/customer/");
    await expect(page.getByRole("dialog", { name: "Where to bring your food?" })).toBeVisible();
    await expect(box(page)).toHaveCount(0);
  });
}
