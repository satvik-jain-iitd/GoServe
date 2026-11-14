// Story 1529 (with the "Delivering to" box of 1530): app open follows the phone, and the first-open screen shows once only.
// Near a saved address: that address. Away from all: "Where you are now", not confirmed, not saved, no Ola call. Not found: the sheet, or Deliver to when there is no place.
// A customer on the Bill is never pulled, a cart never moves to another kitchen by itself, and the phone is never asked on open when it was not allowed before.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { asked, comeBack, phoneLoc, setLoc, setup } from "./helpers";
import { firstOpenToMenu } from "./firstOpen";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-128, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-01T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-05T10:00:00Z" };   // used last
const AT_HOME = { latitude: 28.5690, longitude: 77.2440 };   // about 150 m from Home
const AWAY = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home, far from Work too
const placeOf = (row: typeof HOME) => ({ address: row.address, pin: row.pin_code, lat: row.lat, lng: row.lng, house: "", landmark: "", confirmed: true, id: row.id });
const stored = (context: BrowserContext, place: object, draft?: object) => context.addInitScript(([p, d]) => {
  if (window.localStorage.getItem("gs-place")) return;   // only when nothing is there, so a reload keeps what the app wrote
  window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin);
  if (d) window.localStorage.setItem("gs-draft", JSON.stringify(d));
}, [place, draft ?? null] as const);
const header = (page: Page, name: RegExp) => page.getByRole("button", { name }).first();
const sheet = (page: Page) => page.getByRole("dialog", { name: "Where to bring your food?" });
const box = (page: Page) => page.getByRole("region", { name: "Delivering to" });
const firstScreen = (page: Page) => page.getByRole("heading", { name: "Where does the food go?" });

test("I open the app at home: my phone is near my saved address Home, and Home is picked", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await stored(context, placeOf(WORK));   // the phone remembers Work, the address used last
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });
  await page.goto("/customer/");
  await expect(header(page, /^Home\b/)).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toHaveCount(0);   // a saved address with its pin is confirmed
});

test("I open the app somewhere else: Where you are now is picked, the menu is of the kitchen that serves that place, and the order waits for the map", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await stored(context, placeOf(HOME));
  await phoneLoc(page, { perm: "granted", pos: AWAY });
  await page.goto("/customer/");
  await expect(header(page, /^Where you are now\b/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();   // the kitchen that serves the postal code of that point
  expect(net.calls.rpc.find((c) => c.name === "nearest_pin")?.body).toMatchObject({ p_lat: AWAY.latitude, p_lng: AWAY.longitude });   // our own table gives the postal code
  expect(net.calls.geocode).toHaveLength(0);   // no Ola call on open
  expect(net.calls.addressWrites.filter((w) => w.method === "POST")).toHaveLength(0);   // it is not saved as an address
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
});

test("A cart in progress: the place does not move by itself to another kitchen, and the far strip stays", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.nearPin = "110099";   // no kitchen serves the place the phone is at
  await stored(context, placeOf(HOME), { step: "menu", cart: { d1: 1 }, address: HOME.address, name: "", phone: "" });
  await phoneLoc(page, { perm: "granted", pos: AWAY });
  await page.goto("/customer/");
  await expect(page.getByRole("status").filter({ hasText: /You are \d+ km from Home/ })).toBeVisible();
  await expect(header(page, /^Home\b/)).toBeVisible();
  await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();   // the cart is still there
});

test("On the Bill I am never pulled: the place I chose stays", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await stored(context, placeOf(WORK), { step: "bill", cart: { d1: 1 }, address: WORK.address, name: "", phone: "" });
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect.poll(() => asked(page)).toBe(1);   // the phone was found
  await expect(page.getByRole("group", { name: "Deliver to" })).toContainText(WORK.address);
  await expect(sheet(page)).toHaveCount(0);
});

for (const perm of ["prompt", null] as const) {
  test(`Never allowed (${perm ?? "no permissions.query, an older iPhone"}): the phone is not asked on open, and the sheet shows`, async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });
    net.state.addresses = [HOME, WORK];
    await phoneLoc(page, { perm, pos: AT_HOME });
    await page.goto("/customer/");
    await expect(sheet(page)).toBeVisible();
    await expect(header(page, /^Work\b/)).toBeVisible();   // the address used last waits behind the sheet
    expect(await asked(page)).toBe(0);
    await sheet(page).getByRole("button", { name: "Use my current location" }).click();   // the ask comes on the customer's tap
    await expect(sheet(page)).toHaveCount(0);
    expect(await asked(page)).toBe(1);
    await expect(header(page, /^Home\b/)).toBeVisible();
  });
}

test("I delete my last address: I stay on Deliver to, and I do not see Where does the food go?", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await phoneLoc(page, { perm: "denied", pos: 1 });
  await page.goto("/customer/");
  await sheet(page).getByRole("button", { name: "View all" }).click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Home removed" })).toBeVisible();   // the 6 s Undo stays
  await expect.poll(() => net.state.addresses.length, { timeout: 10_000 }).toBe(0);
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await expect(firstScreen(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);   // no place, so no menu to go back to
  await expect(box(page)).toContainText("Location is blocked for GoServe");
  expect(net.calls.customerWrites.some((w) => typeof w.body.place_confirmed_at === "string")).toBe(true);   // the mark was set while Home was there
  net.state.customer = { name: "", phone: "", address: "", place_confirmed_at: "2026-11-01T10:00:00Z" };   // so the server holds it
  await page.reload();   // the next open: still not the first-open screen
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await expect(firstScreen(page)).toHaveCount(0);
});

test("I delete my last address away from it: Where you are now is picked", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [{ ...HOME, lat: AWAY.latitude, lng: AWAY.longitude }];   // the phone is at Home
  await phoneLoc(page, { perm: "granted", pos: AWAY });
  await page.goto("/customer/");
  await header(page, /^Home\b/).click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect.poll(() => net.state.addresses.length, { timeout: 10_000 }).toBe(0);
  await expect(box(page)).toContainText("Where you are now");
  await expect(firstScreen(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(header(page, /^Where you are now\b/)).toBeVisible();
});

test("I delete my last address with a cart, and my phone is in another kitchen's area: the cart does not move to that kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.nearPin = "110099";   // no kitchen serves the place the phone is at
  await stored(context, placeOf(HOME), { step: "menu", cart: { d1: 1 }, address: HOME.address, name: "", phone: "" });
  await phoneLoc(page, { perm: "granted", pos: AWAY });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /View bill/ })).toBeVisible();   // the cart of the Home kitchen
  await header(page, /^Home\b/).click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect.poll(() => net.state.addresses.length, { timeout: 10_000 }).toBe(0);
  await expect(box(page)).toContainText("Where you are now");
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("gs-draft") ?? "{}").cart ?? {}).length)).toBe(0);   // the old kitchen's cart is not carried to another kitchen
});

test("The first-open screen shows once only: a customer who confirmed a place before, on a new phone, lands on Deliver to", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.customer = { name: "Amit", phone: "9876543210", address: "", place_confirmed_at: "2026-11-01T10:00:00Z" };   // the mark on the server
  await phoneLoc(page, { perm: "prompt", pos: "never" });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
  await expect(firstScreen(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toHaveCount(0);   // the alerts ask uses the same mark
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(sheet(page)).toHaveCount(0);
});

test("A new customer sees the first-open screen, and Confirm & proceed sets the mark on the server", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });
  await page.goto("/customer/");
  await expect(firstScreen(page)).toBeVisible();
  expect(await asked(page)).toBe(0);   // a new customer is asked on the tap
  await firstOpenToMenu(page);
  await expect.poll(() => net.calls.customerWrites.some((w) => typeof w.body.place_confirmed_at === "string")).toBe(true);
});

test("Location is blocked on the first open: I see a true line, and no button does nothing when tapped", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneLoc(page, { perm: "denied", pos: 1 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my current location" }).click();
  const line = page.getByRole("group", { name: "Your address" }).getByRole("status");
  await expect(line).toContainText("Location is blocked for GoServe");
  await page.getByRole("button", { name: "Try location again" }).click();
  await expect(line).toContainText("Still blocked");   // the second tap says something new
  expect(await asked(page)).toBe(2);
  await page.getByRole("button", { name: "Search for my address" }).click();
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeFocused();   // story 1530: the one search
});

test("I turn location on and come back: my place is found without a tap", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await phoneLoc(page, { perm: "granted", pos: 2 });
  await page.goto("/customer/");
  await expect(sheet(page)).toBeVisible();
  await expect(header(page, /^Work\b/)).toBeVisible();
  await setLoc(page, { perm: "granted", pos: AT_HOME });
  await comeBack(page);
  await expect(sheet(page)).toHaveCount(0);
  await expect(header(page, /^Home\b/)).toBeVisible();
  const asks = await asked(page);
  await comeBack(page);   // a find that worked is not made again
  await page.waitForTimeout(300);
  expect(await asked(page)).toBe(asks);
});

test("Deliver to: at home there is no Delivering to box and Home keeps Selected; away the box says Where you are now", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });
  await page.goto("/customer/");
  await header(page, /^Home\b/).click();
  await expect(page.getByRole("button", { name: "Deliver to Home" })).toContainText("Selected");
  await expect(box(page)).toHaveCount(0);
  await phoneLoc(page, { perm: "granted", pos: AWAY });   // the next open is somewhere else
  await page.reload();
  await header(page, /^Where you are now\b/).click();
  await expect(box(page)).toContainText("Where you are now");
  await expect(box(page)).toContainText("Selected");
  await expect(page.getByRole("list").getByText("Selected")).toHaveCount(0);   // no saved row is the place
});

test("Nothing moves: when the location is found or not found, only the Delivering to box changes", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  const rects = () => page.evaluate(() => [".ui-head", ".ui-search-box", ".ui-two-cards", "[aria-label='Delivering to']", "[aria-label='Saved addresses']", ".ui-saved-row:nth-child(1)", ".ui-saved-row:nth-child(2)"]
    .map((s) => { const r = document.querySelector(s)!.getBoundingClientRect(); return [s, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
  await phoneLoc(page, { perm: "granted", pos: AWAY });
  await page.goto("/customer/");
  await header(page, /^Where you are now\b/).click();
  await expect(box(page)).toBeVisible();
  const found = await rects();
  await setLoc(page, { perm: "granted", pos: 3 });   // the phone does not answer in time on the next tap
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(box(page)).toContainText("Finding you is taking too long");
  expect(await rects()).toEqual(found);   // the box has the same place and size too; only its words differ
});

test("A saved address with no pin says Set the pin, and the pick on open skips it", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  net.state.addresses = [{ ...WORK, id: "o1", label: "Old flat", lat: null, lng: null, last_used_at: "2026-11-10T10:00:00Z" }, HOME];   // the old row was used last
  await phoneLoc(page, { perm: "prompt", pos: "never" });
  await page.goto("/customer/");
  await expect(header(page, /^Home\b/)).toBeVisible();
  const row = sheet(page).getByRole("button", { name: "Old flat has no pin. Set the pin" });
  await expect(row).toContainText("Set the pin");
  await sheet(page).getByRole("button", { name: "View all" }).click();
  await page.getByRole("button", { name: "Old flat has no pin. Set the pin" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();   // the tap opens the map, the row is not picked
});

// Reviewer's ask (15 Nov 2026): "Confirm on the map" from the Bill, and the pin is confirmed in ANOTHER postal code. This states what the app does today, as found:
// Story 1540 will change this: the Bill must say the kitchen changed, mark a changed price and show a missing dish as sold out. Until then this test pins the silent change.
// the kitchen becomes the one that serves the new postal code, the customer stays on the Bill, a dish the new kitchen also has stays at the new kitchen's price,
// and a dish it does not have leaves the Bill without a word. The last two are for the owner to rule on; this test only keeps them from changing unseen.
for (const same of [true, false]) {
  test(`Confirm on the map from the Bill, in another postal code: the other kitchen takes over and the Bill stays (${same ? "it has my dish, at its own price" : "it does not have my dish, the Bill is empty"})`, async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });
    net.state.geocode = { status: 200, body: { ok: true, address: "Saket, New Delhi, Delhi", pin: "110017", locality: "Saket", town: "New Delhi" } };
    const kitchens = net.state.kitchens as { id: string; name: string; pin_codes: string[] }[];
    kitchens.push({ ...kitchens[0], id: "k-2", name: "Saket Kitchen", pin_codes: ["110017"] });
    net.state.serve = { status: 200, body: { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-2", name: "Saket Kitchen", distance_m: 900, eta_min: 25, open: true }] } };
    await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    const dish = same ? { id: "d1", name: "Butter Chicken", price_paise: 35000 } : { id: "d9", name: "Dal Makhani", price_paise: 20000 };
    await page.route("**/rest/v1/menu_items*kitchen_id=eq.k-2*", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify([{ ...dish, image_url: null, image_credit: null }]) }));
    await stored(context, { address: "Where you are now", pin: "110016", lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: false, id: null });
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Add Butter Chicken" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await expect(page.getByText("Hauz Khas Kitchen · 110016")).toBeVisible();
    await page.getByRole("button", { name: "Confirm on the map" }).click();
    await page.getByRole("button", { name: "Confirm & proceed" }).click();
    await page.getByLabel("House, street, colony, ward").fill("B-12");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();   // the Bill stays
    await expect(page.getByText("Saket Kitchen · 110017")).toBeVisible();   // the kitchen of the new postal code
    await expect(page.getByRole("button", { name: "Confirm on the map" })).toHaveCount(0);
    if (same) {
      await expect(page.getByText("1 × Butter Chicken")).toBeVisible();
      await expect(page.getByText("₹350", { exact: true })).toBeVisible();   // the new kitchen's price (it was 320)
      await page.getByLabel("Phone").fill("9876543210");
      await page.getByRole("button", { name: /Place order/ }).click();
      await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
      expect(net.calls.place[0].body.address).toMatchObject({ pin_code: "110017" });
    } else {
      await expect(page.getByText("Nothing on it yet")).toBeVisible();   // the dish is gone, with no line saying why
      await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);
    }
  });
}
