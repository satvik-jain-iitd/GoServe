// Story 1540: the delivery place changes to one that another kitchen serves while the cart has dishes. The Bill says the kitchen changed, marks each changed price on its row,
// and shows a dish the new kitchen does not make with the sold-out pattern. The menu says the same line. Nothing is ordered at an old price or for a dish the kitchen does not make.
// A dish is the same dish in the other kitchen when it has the same id or the same name (each kitchen has its own rows in menu_items, so the ids differ in real data).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { phoneLoc, setup, toDeliverTo } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const CHANGED = "The kitchen changed. See your bill.";   // the menu's line: one short line in the greeting box, so nothing on the menu moves (owner's rule 23); the Bill names the dishes and the prices
const greet = (page: Page) => page.locator(".ui-greet-line");
const ON_BILL = "The kitchen changed. Prices are new.";   // the Bill's line: one short line under the title, in the header that is always there
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const SAKET = { id: "s1", label: "Office", address: "B-12, Saket", pin_code: "110017", lat: 28.5245, lng: 77.2066, last_used_at: "2026-11-01T10:00:00Z" };
const AT_HOME = { latitude: 28.5683, longitude: 77.2436 };
const MENU_A = [{ id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null }, { id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null }];
const BOTH = [{ id: "b1", name: "Butter Chicken", price_paise: 35000 }, { id: "b2", name: "Dal Makhani", price_paise: 22000 }];   // the other kitchen: its own ids, one price differs
const ONE = [BOTH[0]];   // the other kitchen does not make Dal Makhani
type Net = Awaited<ReturnType<typeof setup>>;

async function twoKitchens(net: Net, page: Page, menuB: object[]) {
  net.state.menu = MENU_A;
  const kitchens = net.state.kitchens as { id: string; name: string; pin_codes: string[] }[];
  kitchens.push({ ...kitchens[0], id: "k-2", name: "Saket Kitchen", pin_codes: ["110017"] });
  await page.route("**/rest/v1/menu_items*kitchen_id=eq.k-2*", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(menuB.map((d) => ({ ...d, image_url: null, image_credit: null }))) }));
}
const row = (page: Page, dish: string) => page.locator(".ui-slip-lines > div").filter({ hasText: dish });
const total = (page: Page) => page.getByTestId("bill-total");
// Owner's rule 23, no layout shift: where every part of the Bill sits. The Bill with the line is laid over the Bill without it: only the header may differ, and it keeps its size.
const PARTS = [".ui-head", ".ui-head h1", ".ui-back", ".ui-slip", ".ui-slip-head", ".ui-slip-lines > div >> nth=0", ".ui-slip-lines > div >> nth=1", ".ui-slip-total", ".ui-add-more", "#phone", "[aria-label='Deliver to']", "#note", ".ui-pay", ".ui-sticky", ".ui-sticky .ui-btn"];
const boxes = async (page: Page) => ({ ...Object.fromEntries(await Promise.all(PARTS.map(async (sel) => [sel, await page.locator(sel).boundingBox()]))), long: await page.locator(".ui-scroll").evaluate((el) => el.scrollHeight) }) as Record<string, { x: number; y: number; width: number; height: number } | null>;

// On the Bill with both dishes, then "Confirm on the map" in the other kitchen's postal code: the customer stays on the Bill.
async function billThenSaket(page: Page, context: BrowserContext, menuB: object[]) {
  const net = await setup(context, page, [], { pin: null });
  await twoKitchens(net, page, menuB);
  net.state.geocode = { status: 200, body: { ok: true, address: "Saket, New Delhi, Delhi", pin: "110017", locality: "Saket", town: "New Delhi" } };
  net.state.serve = { status: 200, body: { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-2", name: "Saket Kitchen", distance_m: 900, eta_min: 25, open: true }] } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.addInitScript((p) => { if (!window.localStorage.getItem("gs-place")) { window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", "110016"); } },
    { address: "Where you are now", pin: "110016", lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: false, id: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: "Add Dal Makhani" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByText("Hauz Khas Kitchen · 110016")).toBeVisible();
  await expect(total(page)).toHaveText("₹540");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: "Confirm on the map" }).click();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await page.getByLabel("House, street, colony, ward").fill("B-12");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("Saket Kitchen · 110017")).toBeVisible();
  return { net };
}
// On the menu at Home with both dishes in the cart; Office is in the other kitchen's postal code.
async function menuWithCart(page: Page, context: BrowserContext, menuB: object[], other: object = SAKET, recents: object[] = []) {
  const net = await setup(context, page, [], { pin: null });
  await twoKitchens(net, page, menuB);
  net.state.addresses = [HOME, other];
  net.state.recents = recents;
  await context.addInitScript(([p, d]) => { if (!window.localStorage.getItem("gs-place")) { window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", "110016"); window.localStorage.setItem("gs-draft", JSON.stringify(d)); } },
    [{ address: HOME.address, pin: "110016", lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: true, id: "h1" }, { step: "menu", cart: { d1: 1, d2: 1 }, address: HOME.address, name: "", phone: "" }] as const);
  await phoneLoc(page, { perm: "granted", pos: AT_HOME });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("₹540");
  return net;
}
const cartIds = (page: Page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("gs-draft") ?? "{}").cart ?? {}).sort());

test("The kitchen changes on the Bill: the Bill says the kitchen changed, each changed price is marked on its row, and the total is the sum of the rows I see", async ({ page, context }) => {
  await billThenSaket(page, context, BOTH);
  await expect(page.getByRole("status").filter({ hasText: ON_BILL })).toBeVisible();
  await expect(row(page, "1 × Butter Chicken")).toContainText("350");
  await expect(row(page, "1 × Butter Chicken").locator("s")).toHaveText("320");   // the old price, struck, on the same row
  await expect(row(page, "1 × Dal Makhani")).toContainText("220");
  await expect(row(page, "1 × Dal Makhani").locator("s")).toHaveCount(0);   // the same price: no mark
  await expect(total(page)).toHaveText("₹570");   // 350 + 220
});

// Review of PR 1546, note 11: "Prices are new" is said only when a price differs for this customer.
const SAME = [{ ...BOTH[0], price_paise: 32000 }, BOTH[1]];   // the other kitchen: its own ids, the same prices
test("The kitchen changes and no price differs: the Bill says only that the kitchen changed", async ({ page, context }) => {
  await billThenSaket(page, context, SAME);
  await expect(page.locator(".ui-head-under")).toHaveText("The kitchen changed.");
  await expect(page.locator(".ui-slip-lines s")).toHaveCount(0);   // no price is marked, so no line may say a price is new
  await expect(total(page)).toHaveText("₹540");
});

test("The kitchen changes, no price differs and one dish is not made: the Bill says only that the kitchen changed, and the dish has its row", async ({ page, context }) => {
  await billThenSaket(page, context, [SAME[0]]);
  await expect(page.locator(".ui-head-under")).toHaveText("The kitchen changed.");
  await expect(page.getByRole("alert").filter({ hasText: "Dal Makhani is not made by this kitchen." })).toBeVisible();
  await expect(row(page, "1 × Butter Chicken").locator("s")).toHaveCount(0);
  await expect(total(page)).toHaveText("₹320");
});

test("Nothing moves when the Bill says the kitchen changed: only the header carries the line, and every part keeps its place and its size", async ({ page, context }) => {
  // The same Bill twice, after the place is confirmed in Saket: once as the new kitchen's own bill (after a reload the line is gone), once with the line.
  await billThenSaket(page, context, BOTH);
  await expect(page.getByRole("status").filter({ hasText: ON_BILL })).toBeVisible();
  await page.getByLabel("Phone").fill("9876543210");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
  const withLine = await boxes(page);
  const line = (await page.getByRole("status").filter({ hasText: ON_BILL }).boundingBox())!;
  const head = withLine[".ui-head"]!, title = withLine[".ui-head h1"]!;
  expect(line.y).toBeGreaterThanOrEqual(title.y + title.height);   // under the title, never on it
  expect(line.y + line.height).toBeLessThanOrEqual(head.y + head.height - 1);   // inside the header, above its rule
  expect(line.x).toBeGreaterThanOrEqual(title.x - 1);
  expect(line.height).toBeLessThanOrEqual(18);   // one line
  expect(await page.getByRole("status").filter({ hasText: ON_BILL }).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);   // the whole line shows, none of it is cut
  await page.reload();
  await expect(page.getByText("Saket Kitchen · 110017")).toBeVisible();
  await expect(page.getByText(ON_BILL)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
  const without = await boxes(page);
  for (const sel of PARTS) expect(without[sel], sel).not.toBeNull();
  expect(without).toEqual(withLine);   // laid over each other, nothing differs but the line itself; "long" is the length of the Bill: what fit still fits
});

test("A dish that is sold out in the new kitchen uses the sold-out words, never 'not made'", async ({ page, context }) => {
  await billThenSaket(page, context, [{ ...BOTH[0], available: false }, BOTH[1]]);
  await expect(page.getByRole("alert").filter({ hasText: "Butter Chicken is sold out." })).toBeVisible();
  await expect(page.getByText("is not made by this kitchen")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
});

test("A dish the new kitchen does not sell: it shows as not available with the way out next to it, and it is not in the total", async ({ page, context }) => {
  await billThenSaket(page, context, ONE);
  await expect(page.getByRole("status").filter({ hasText: ON_BILL })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Dal Makhani is not made by this kitchen." })).toBeVisible();
  await expect(row(page, "1 × Dal Makhani")).toHaveCSS("text-decoration-line", "line-through");
  await expect(total(page)).toHaveText("₹350");   // only the dish this kitchen makes
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
  await page.getByRole("button", { name: "Take it out" }).click();
  await expect(row(page, "Dal Makhani")).toHaveCount(0);
  await expect(total(page)).toHaveText("₹350");
  await page.getByLabel("Phone").fill("9876543210");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("The order: it goes to kitchen B at the prices on the Bill, for the dishes kitchen B makes", async ({ page, context }) => {
  const { net } = await billThenSaket(page, context, ONE);
  await page.getByRole("button", { name: "Take it out" }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  const sent = net.calls.place[0].body;
  expect(sent.kitchen_id).toBe("k-2");
  expect(sent.lines.map((l: { menu_item_id: string; qty: number }) => [l.menu_item_id, l.qty])).toEqual([["b1", 1]]);   // kitchen B's own dish, never kitchen A's id
  expect(sent.expected_to_pay_paise).toBe(35000);   // the total on the Bill
  expect(sent.address).toMatchObject({ pin_code: "110017" });
});

test("I pick a saved address of another kitchen with a cart: the menu says the kitchen changed, and the Bill marks the price and shows the dish it does not make", async ({ page, context }) => {
  await menuWithCart(page, context, ONE);
  await toDeliverTo(page);
  await page.getByRole("button", { name: "Deliver to Office" }).click();
  await saysItChanged(page);
  await page.getByRole("button", { name: "Take it out" }).click();
  await page.getByRole("button", { name: "Back to menu" }).click();
  await expect(greet(page)).toHaveText(/^Open till/);   // the Bill was opened: the greeting is back
});

// The reviewer's ask: a place changes in three ways (a saved address above, a recent, a search confirmed on the pin map). Each one ends at the same point in the app.
const RECENT = { id: "r1", name: "Sample Nagar", address: "Flat 2, Sample Nagar", pin_code: "110017", lat: SAKET.lat, lng: SAKET.lng, house: "Flat 2", landmark: null, used_at: "2026-11-10T10:00:00Z" };
async function saysItChanged(page: Page) {   // the same as for a saved address
  await expect(greet(page)).toHaveText(CHANGED);   // the menu names no dish and no price
  await expect(greet(page)).toHaveAttribute("role", "status");
  await expect(page.locator(".ui-closed-note")).toHaveCount(0);   // no box in the flow of the menu
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("₹350");
  expect(await cartIds(page)).toEqual(["b1"]);   // the cart holds the new kitchen's dish
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("status").filter({ hasText: ON_BILL })).toBeVisible();   // the Bill still says it
  await expect(row(page, "1 × Butter Chicken").locator("s")).toHaveText("320");
  await expect(page.getByRole("alert").filter({ hasText: "Dal Makhani is not made by this kitchen." })).toBeVisible();   // nothing is lost without a word: the dish is a row on the Bill, with the way out
  await expect(row(page, "1 × Dal Makhani")).toHaveCSS("text-decoration-line", "line-through");
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
  await expect(total(page)).toHaveText("₹350");
}

test("I tap a recent of another kitchen with a cart: the menu says the kitchen changed, and the Bill marks the price and shows the dish it does not make", async ({ page, context }) => {
  await menuWithCart(page, context, ONE, SAKET, [RECENT]);
  await toDeliverTo(page);
  await page.getByRole("region", { name: "Recently searched" }).getByRole("button", { name: "Deliver to Sample Nagar" }).click();
  await saysItChanged(page);
});

test("I search a place of another kitchen and confirm it on the pin map with a cart: the menu says the kitchen changed, and the Bill marks the price", async ({ page, context }) => {
  const net = await menuWithCart(page, context, ONE);
  net.state.places = { status: 200, body: { ok: true, results: [{ name: "Sample Nagar", address: "Sample Nagar, Delhi, 110017", lat: SAKET.lat, lng: SAKET.lng, pin: "110017", served: true, from: "own" }] } };
  net.state.geocode = { status: 200, body: { ok: true, address: "Saket, New Delhi, Delhi", pin: "110017", locality: "Saket", town: "New Delhi" } };
  net.state.nearPin = "110017";
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await toDeliverTo(page);
  await page.getByRole("searchbox", { name: "Search an area or address" }).fill("sample");
  await page.getByRole("region", { name: "Places" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await page.getByLabel("House, street, colony, ward").fill("Flat 2");
  await page.getByRole("button", { name: "Deliver here" }).click();
  await saysItChanged(page);
});

test("I pick a saved address the same kitchen serves: no line, no mark, the cart as it was", async ({ page, context }) => {
  await menuWithCart(page, context, BOTH, { ...SAKET, pin_code: "110016" });
  await toDeliverTo(page);
  await page.getByRole("button", { name: "Deliver to Office" }).click();
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("₹540");
  await expect(greet(page)).toHaveText(/^Open till/);
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.locator(".ui-slip-lines s")).toHaveCount(0);
  expect(await cartIds(page)).toEqual(["d1", "d2"]);
});

test("No kitchen serves the new place: the no-kitchen screen shows and the cart is kept", async ({ page, context }) => {
  await menuWithCart(page, context, BOTH, { ...SAKET, pin_code: "110099" });
  await toDeliverTo(page);
  await page.getByRole("button", { name: "Deliver to Office" }).click();
  await expect(page.getByRole("heading", { name: "We don't reach here yet" })).toBeVisible();
  expect(await cartIds(page)).toEqual(["d1", "d2"]);
  await page.getByRole("button", { name: "Deliver to a saved address" }).click();
  await page.getByRole("button", { name: "Deliver to Home" }).click();
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("₹540");   // back at the first kitchen: the same cart, the same prices
  await expect(page.getByText(CHANGED)).toHaveCount(0);
});

test("The kitchens cannot be read after the place changes: the cart is kept, and when the network is back the line shows", async ({ page, context }) => {
  await menuWithCart(page, context, BOTH);
  let down = true;
  await page.route("**/rest/v1/kitchens*", (r) => (down ? r.abort() : r.fallback()));
  await toDeliverTo(page);
  await page.getByRole("button", { name: "Deliver to Office" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No internet. Check your internet and try again." })).toBeVisible({ timeout: 15_000 });   // the read is tried again before it gives up
  expect(await cartIds(page)).toEqual(["d1", "d2"]);
  down = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("status").filter({ hasText: CHANGED })).toBeVisible();
  await expect(page.getByRole("button", { name: /View bill/ })).toContainText("₹570");
  expect(await cartIds(page)).toEqual(["b1", "b2"]);
});

test("I empty the cart on the menu after the kitchen changed: the greeting is back, there is no bill to see", async ({ page, context }) => {
  await menuWithCart(page, context, ONE);
  await toDeliverTo(page);
  await page.getByRole("button", { name: "Deliver to Office" }).click();
  await expect(greet(page)).toHaveText(CHANGED);
  await page.getByRole("button", { name: "Less Butter Chicken" }).click();
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  await expect(greet(page)).toHaveText(/^Open till/);
});

test("No dish of my cart is made by the new kitchen: the menu says the bill was cleared, in the greeting box", async ({ page, context }) => {
  await menuWithCart(page, context, [{ id: "b9", name: "Veg Thali", price_paise: 19900 }]);
  await toDeliverTo(page);
  await page.getByRole("button", { name: "Deliver to Office" }).click();
  await expect(greet(page)).toHaveText("Place changed. Your bill was cleared.");
  await expect(page.getByRole("button", { name: /View bill/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add Veg Thali" }).click();   // the next tap on the menu uses the line up
  await expect(greet(page)).toHaveText(/^Open till/);
});

// Owner's rule 23 on the menu (review of PR 1546, note 15): the menu with the line laid over the menu without it, in the same state (the same place, the same strip, the same cart).
// Only the words of the greeting box differ. Each line is one line, whole, inside the box of a 360 px wide phone.
const MENU_PARTS = [".ui-top", ".ui-farstrip", ".ui-scroll", ".ui-greet", ".ui-greet-line", ".ui-section", ".ui-tile", ".ui-sticky", ".ui-sticky .ui-btn", ".ui-tabs"];
const menuBoxes = (page: Page) => page.evaluate((sels) => Object.fromEntries(sels.map((s) => [s, [...document.querySelectorAll(s)].map((el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })])), MENU_PARTS);
const oneLine = (page: Page) => greet(page).evaluate((el) => ({ whole: el.scrollWidth <= el.clientWidth, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), width: el.getBoundingClientRect().width }));
for (const width of [360, 412]) {
  test(`Nothing moves on the menu when it says the kitchen changed, at ${width} px wide: only the words of the greeting box differ`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await menuWithCart(page, context, BOTH);
    await toDeliverTo(page);
    await page.getByRole("button", { name: "Deliver to Office" }).click();
    await expect(greet(page)).toHaveText(CHANGED);
    await expect(page.getByRole("button", { name: /View bill/ })).toContainText("₹570");
    const withLine = await menuBoxes(page);
    expect(await oneLine(page)).toEqual({ whole: true, lines: 1, width: width - 40 });   // one line, none of it cut, in the 320 px box of a 360 px phone
    await page.getByRole("button", { name: /View bill/ }).click();
    await page.getByRole("button", { name: "Back to menu" }).click();
    await expect(greet(page)).toHaveText(/^Open till/);   // the same menu, the same place and cart, without the line
    const without = await menuBoxes(page);
    for (const sel of MENU_PARTS.filter((s) => s !== ".ui-farstrip")) expect(without[sel].length, sel).toBeGreaterThan(0);
    expect(without[".ui-tile"].length).toBe(2);
    expect(without).toEqual(withLine);
  });
}
