// Regression, screen 4: A1p Pin on the map (first open). Cases: .claude/handoff/qa/screens/04-A1p.md (epic #1196, story #1197). Reached with the shared step STEPS["first-open-pin"].
import { test, expect, type BrowserContext, type Page, type Locator } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// The phone's place (the step gives it to the browser). The map's own lookups and serviceability answers are set by mapAnswers below.
const START = { lat: 24.8847, lng: 79.597 };
const GREEN = "Green Avenue Colony, Satai Road, Chhatarpur, Madhya Pradesh 471001";
const SHANTI = "Shanti Nagar, Satai Road, Chhatarpur, Madhya Pradesh 471001";
const KITCHEN = { lat: 24.8847, lng: 79.60919 };   // the test kitchen: 1.2 km east of the phone
const FAR_LNG = 79.61;   // east of this, no kitchen reaches the pin (about 1.3 km past the phone)
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };

const box = async (loc: Locator) => (await loc.boundingBox())!;
const mapBox = (page: Page) => page.getByRole("application", { name: "Map" });
const pinSpan = (page: Page) => page.locator(".ui-pinmap-pin");
const confirm = (page: Page) => page.getByRole("button", { name: "Confirm & proceed" });
const json = (route: import("@playwright/test").Route, body: unknown) => route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
const at = (url: string) => { const u = new URL(url); return { lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) }; };
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

// The map's own answers, registered after the shared step (a route added later wins over the step's). The words follow the pin: GREEN at the phone, SHANTI once moved.
// Serviceability: a kitchen 1.2 km from the phone, 'the kitchen is N m' follows the pin; east of FAR_LNG nothing reaches. holdLookup keeps the words waiting until release() is called.
async function mapAnswers(context: BrowserContext, { holdLookup = false } = {}) {
  const lookups: { lat: number; lng: number }[] = [];
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await context.route("https://test.supabase.co/functions/v1/geocode**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const p = at(route.request().url());
    lookups.push(p);
    if (holdLookup) await gate;
    return json(route, { ok: true, address: metres(p, START) > 100 ? SHANTI : GREEN, pin: "471001" });
  });
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const p = at(route.request().url());
    if (p.lng >= FAR_LNG) return json(route, { ok: true, serviceable: false, request_here: false, kitchens: [] });
    return json(route, { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-1", name: "Hauz Khas Kitchen", distance_m: Math.round(metres(p, KITCHEN)), eta_min: 30, open: true }] });
  });
  return { lookups, release: () => release() };
}

// One drag of the map to the left (the centre moves east), started near the right edge so it stays on the phone.
async function dragMap(page: Page, px = 300, west = false) {   // west: the centre moves west, away from the east edge where no kitchen reaches
  const b = await box(mapBox(page));
  const y = b.y + b.height / 2;
  const x = west ? b.x + 30 : b.x + b.width - 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(west ? x + px : x - px, y, { steps: 15 });
  await page.mouse.up();
}

test("TC 4.1 map opens: Back and search on top, pin in the middle, Current Location above the sheet, the sheet with the place, We deliver here, Confirm, Ola credit", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  await mapAnswers(context);
  await expect(mapBox(page)).toBeVisible();
  const back = await box(page.getByRole("button", { name: "Back" }));
  const search = await box(page.getByRole("button", { name: "Search an area or address" }));
  const here = await box(page.getByRole("button", { name: "Current Location" }));
  const name = page.getByText("Green Avenue Colony", { exact: true });
  await expect(name).toBeVisible();
  const nameBox = await box(name);
  const pin = await box(pinSpan(page));
  const map = await box(mapBox(page));
  expect(back.y).toBeLessThan(pin.y);   // on top
  expect(search.y).toBeLessThan(pin.y);
  expect(Math.abs(pin.x + pin.width / 2 - (map.x + map.width / 2))).toBeLessThanOrEqual(4);   // pin in the middle
  expect(Math.abs(pin.y + pin.height / 2 - (map.y + map.height / 2))).toBeLessThanOrEqual(24);
  expect(here.y).toBeGreaterThan(pin.y);   // Current Location chip is in the sheet, above the place name
  expect(here.y).toBeLessThan(nameBox.y);
  await expect(page.getByText("Satai Road, Chhatarpur, Madhya Pradesh 471001", { exact: true })).toBeVisible();   // full address
  await expect(page.getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible();
  await expect(confirm(page)).toBeEnabled();   // filled, live
  await expect(page.getByRole("link", { name: "Ola Maps" })).toBeVisible();
  await expect(page.getByRole("link", { name: "© OpenStreetMap contributors" })).toBeVisible();
});

test("TC 4.2 Confirm & proceed: Address details, Step 3 of 4 in first set-up, with the same place", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  await mapAnswers(context);
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  const details = page.getByRole("dialog", { name: "Address details" });
  await expect(details).toBeVisible();
  await expect(details.getByText("Step 3 of 4")).toBeVisible();   // #1390 (owner, 13 Nov): first set-up counts 3 of 4 on the sheet too
  await expect(details.getByText("Green Avenue Colony", { exact: true })).toBeVisible();   // the same place the map rested on
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);   // the map step is gone
});

test("TC 4.3 drag the map about 1 km: the pin stays centred, the place and the distance update once the map stops", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  const { lookups } = await mapAnswers(context);
  await expect(page.getByText("Green Avenue Colony", { exact: true })).toBeVisible();   // the first place shows before the drag
  for (let i = 0; i < 5; i++) await dragMap(page, 300, true);   // five drags of 300 px, roughly 1 km at this zoom (3 drags gave about 650 m)
  await expect(page.getByText("Shanti Nagar", { exact: true })).toBeVisible();   // the place follows the map once it stops
  await expect(page.getByText("Green Avenue Colony", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/the kitchen is [\d.]+ (km|m) from the pin/)).toBeVisible();   // a distance line shows for the new spot
  await expect(page.getByText("the kitchen is 1.2 km from the pin")).toHaveCount(0);   // and it moved on from the first spot's 1.2 km
  const last = lookups.at(-1)!;
  expect(metres(last, START)).toBeGreaterThan(700);   // it really moved about a kilometre
  expect(metres(last, START)).toBeLessThan(1600);
  const pin = await box(pinSpan(page));
  const map = await box(mapBox(page));
  expect(Math.abs(pin.x + pin.width / 2 - (map.x + map.width / 2))).toBeLessThanOrEqual(4);   // still centred
  await expect(confirm(page)).toBeEnabled();
});

test("TC 4.4 Current Location: the map flies back to my spot", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  const { lookups } = await mapAnswers(context);
  await dragMap(page);
  await dragMap(page);
  await expect(page.getByText("Shanti Nagar", { exact: true })).toBeVisible();   // moved away from the phone
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect(page.getByText("Green Avenue Colony", { exact: true })).toBeVisible();   // back on the phone's place
  await expect.poll(() => metres(lookups.at(-1) ?? { lat: 0, lng: 0 }, START)).toBeLessThan(5);   // the last lookup is at my spot
});

test("TC 4.5 drag to a place no kitchen serves: the sheet becomes the far one, no Confirm", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  const { lookups } = await mapAnswers(context);
  await expect(confirm(page)).toBeEnabled();   // a served pin shows Confirm first, so its absence below is real
  for (let i = 0; i < 7; i++) await dragMap(page);   // about 2.3 km east, past the kitchen's reach
  await expect(page.getByRole("button", { name: "Invite the founders here" })).toBeVisible();
  await expect(page.getByText("Not in our area yet")).toBeVisible();
  await expect(page.getByText(/km from where you are now/)).toBeVisible();   // the yellow distance line from the phone
  await expect(confirm(page)).toHaveCount(0);
  expect(lookups.at(-1)!.lng).toBeGreaterThanOrEqual(FAR_LNG);
});

test("TC 4.6 the map tiles fail to load: the map is still there and Confirm still works for a served pin", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  await mapAnswers(context);
  let tiles = 0;
  await context.route("https://tiles.test/**", (route) => { tiles++; return route.abort(); });   // the tiles are refused from now on
  await dragMap(page);   // a move asks for new tiles, which now fail (the first ones loaded before this route)
  await expect(mapBox(page)).toBeVisible();
  await expect.poll(() => tiles).toBeGreaterThan(0);   // the failure really happened
  await expect(page.getByText(/We deliver here · the kitchen is \d+ (m|km) from the pin/)).toBeVisible();   // the moved pin is still served
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
});

test("TC 4.7 Back: returns to Step 3, not to welcome", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  await mapAnswers(context);
  await expect(mapBox(page)).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toHaveCount(0);
});

test("TC 4.8 bad network, the place name is slow: Confirm waits for it", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, PATH);
  const { lookups, release } = await mapAnswers(context, { holdLookup: true });   // the words stay in flight until released
  await dragMap(page);
  await expect.poll(() => lookups.length).toBeGreaterThan(0);   // the slow lookup is really in flight
  await expect(confirm(page)).toBeDisabled();   // Confirm waits for the place
  test.fail(true, "#1200: the pin screen shows no 'finding the place' line while the place is looked up; Confirm is only greyed out");
  await expect(page.getByText(/finding the place/i)).toBeVisible();
  release();
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
});
