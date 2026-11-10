// Regression, screen 6: C6e Pin map with the GoServe kitchen plate. Cases: .claude/handoff/qa/screens/06-C6e.md (epic #1196, story #1197). Reached with the shared step STEPS["pin-map"].
import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// The phone. The map opens on it (mapStart is the phone once it is known), so the pin sits here.
const HERE = { lat: 24.8847, lng: 79.597 };
const ZOOM = 17;   // PinMapScreen's default zoom
const WORLD = 256 * 2 ** ZOOM;   // Leaflet's Web Mercator world size in CSS pixels at this zoom
const mercX = (lng: number) => ((lng + 180) / 360) * WORLD;
const mercY = (lat: number) => (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * WORLD;
const unX = (x: number) => (x / WORLD) * 360 - 180;
const unY = (y: number) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / WORLD));
// The place dx pixels right and dy pixels down from the phone, in the map's own projection (dy < 0 is north).
const from = (dx: number, dy = 0) => ({ lat: unY(mercY(HERE.lat) + dy), lng: unX(mercX(HERE.lng) + dx) });
// How many pixels are `m` metres at the phone's latitude and this zoom.
const pxFor = (m: number) => m / ((156543.03392 * Math.cos((HERE.lat * Math.PI) / 180)) / 2 ** ZOOM);

type K = { id: string; lat: number; lng: number };
// Test double, test only: the customer's kitchen list gets a place for the GoServe kitchens (the fixture k-1 has none). Rows the list lacks are added. The app is not changed.
async function kitchens(context: BrowserContext, list: K[]) {
  await context.addInitScript((want: K[]) => {
    const real = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await real(input, init);
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!res.ok || !new URL(raw).pathname.endsWith("/rest/v1/kitchens")) return res;
      const rows = (await res.clone().json()) as Record<string, unknown>[];
      for (const w of want) {
        const row = rows.find((r) => r.id === w.id);
        if (row) Object.assign(row, { lat: w.lat, lng: w.lng });
        else rows.push({ id: w.id, name: "Test kitchen", phone: null, pin_codes: ["000001"], radius_m: null, lat: w.lat, lng: w.lng, open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00", synthetic: false });
      }
      return new Response(JSON.stringify(rows), { status: res.status, headers: res.headers });
    };
  }, list);
}

async function phoneAtHere(context: BrowserContext) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: HERE.lat, longitude: HERE.lng });
}

const map = (page: Page) => page.getByRole("region", { name: "Pin map" });
const plate = (page: Page) => page.locator(".gs-kitchen-mark svg");
const tag = (page: Page) => page.getByText("GoServe Kitchen", { exact: true });
const mapBox = async (page: Page) => (await page.locator(".ui-pinmap-map").boundingBox())!;
const centre = async (page: Page) => { const b = await mapBox(page); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const mid = async (loc: Locator) => { const b = (await loc.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);

// The map is open on the phone: the screen shows, and the my-location dot sits in the map's centre, so the pin is on the phone.
async function openedOnPhone(page: Page) {
  await expect(map(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
  await expect(page.locator(".gs-here-dot")).toBeVisible();
  const c = await centre(page), d = await mid(page.locator(".gs-here-dot"));
  expect(Math.abs(c.x - d.x)).toBeLessThanOrEqual(3);
  expect(Math.abs(c.y - d.y)).toBeLessThanOrEqual(3);
}

test("TC 6.1 open the map near a kitchen: the plate with the tag GoServe Kitchen sits at the kitchen", async ({ page, context }) => {
  await kitchens(context, [{ id: "k-1", ...from(60) }]);   // 60 px east of the pin: clear of the pin, the tag fits the screen
  await phoneAtHere(context);
  await STEPS["pin-map"](context, page, PATH);
  await openedOnPhone(page);
  await expect(plate(page)).toBeVisible();
  await expect(tag(page)).toBeVisible();
  const c = await centre(page), m = await mid(plate(page));
  expect(Math.abs(m.x - (c.x + 60))).toBeLessThanOrEqual(3);   // the plate's centre is the kitchen's point
  expect(Math.abs(m.y - c.y)).toBeLessThanOrEqual(3);
});

test("TC 6.2 move the pin onto the kitchen: the plate hides where it would touch the pin", async ({ page, context }) => {
  await kitchens(context, [{ id: "k-1", ...from(60) }]);
  await phoneAtHere(context);
  await STEPS["pin-map"](context, page, PATH);
  await openedOnPhone(page);
  await expect(plate(page)).toBeVisible();   // proves the plate is drawn before the map moves
  // drag the map 60 px to the left: the kitchen comes under the pin
  await page.mouse.move(295, 300); await page.mouse.down(); await page.mouse.move(235, 300, { steps: 12 }); await page.mouse.up();
  await expect(plate(page)).toHaveCount(0);
  await expect(map(page)).toBeVisible();
});

test("TC 6.3 Confirm & proceed: Address details opens (the auto half)", async ({ page, context }) => {
  await STEPS["pin-map"](context, page, PATH);
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();   // the button shows before the tap
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
});

test("TC 6.4 tap the plate: nothing happens, the pin screen stays and the plate does not move", async ({ page, context }) => {
  await kitchens(context, [{ id: "k-1", ...from(60) }]);
  await phoneAtHere(context);
  await STEPS["pin-map"](context, page, PATH);
  await openedOnPhone(page);
  const art = plate(page);
  await expect(art).toBeVisible();
  const before = await mid(art);
  await page.mouse.click(before.x, before.y);
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();   // still the pin screen, so the absence below means something
  await expect(page.getByRole("dialog", { name: "Address details" })).toHaveCount(0);
  await expect(map(page)).toHaveAttribute("data-step", "pin");
  const after = await mid(art);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});

test("TC 6.5 two kitchens in view: two plates, the two tags do not overlap", async ({ page, context }) => {
  await kitchens(context, [{ id: "k-1", ...from(60) }, { id: "k-2", ...from(60, -150) }]);   // one east of the pin, one 150 px north of it
  await phoneAtHere(context);
  await STEPS["pin-map"](context, page, PATH);
  await openedOnPhone(page);
  await expect(plate(page)).toHaveCount(2);
  await expect(tag(page)).toHaveCount(2);
  const a = (await page.locator(".gs-kitchen-tag").nth(0).boundingBox())!, b = (await page.locator(".gs-kitchen-tag").nth(1).boundingBox())!;
  expect(overlap(a, b), "the two tags overlap").toBe(false);
});

test("TC 6.7 the pin 110 m from the kitchen: the tag never sits under the pin, its halo or the my-location dot", async ({ page, context }) => {
  await kitchens(context, [{ id: "k-1", ...from(-pxFor(110)) }]);   // 110 m west: the tag would run out to the pin's side
  await phoneAtHere(context);
  await STEPS["pin-map"](context, page, PATH);
  await openedOnPhone(page);
  await expect(plate(page)).toBeVisible();   // the plate is drawn (its art is clear of the pin), so the tag check below is about a live plate
  const obstacles = {
    pin: (await page.locator(".ui-pinmap-pin").boundingBox())!,
    halo: (await page.locator(".ui-pinmap-pin circle").first().boundingBox())!,
    dot: (await page.locator(".gs-here-dot").boundingBox())!,
  };
  if (await tag(page).isVisible()) {   // a hidden tag is fine; a shown tag must clear all three
    const t = (await tag(page).boundingBox())!;
    for (const [name, box] of Object.entries(obstacles)) expect(overlap(t, box), `the tag sits under the ${name}`).toBe(false);
  }
  // Second geometry, same kitchen: the pin moves 110 m south, away from the phone. The tag now runs under the my-location dot, which the pin-and-card check does not see.
  await page.mouse.move(100, 300); await page.mouse.down(); await page.mouse.move(100, 198, { steps: 12 }); await page.mouse.up();
  await expect(plate(page)).toBeVisible();   // the plate is still drawn, so the check below is live
  await expect(page.locator(".gs-here-dot")).toBeVisible();
  let lastDot = "";   // the map may coast after the drag (inertia); wait until the dot rests, so the moveend placement has run
  await expect.poll(async () => { const d = JSON.stringify(await page.locator(".gs-here-dot").boundingBox()); const rest = d === lastDot; lastDot = d; return rest; }, { timeout: 5_000 }).toBe(true);
  test.fail(true, "#1202: the GoServe Kitchen tag is drawn under the my-location dot when the pin is off the phone (the app hides it only for the pin, the card and the top bar)");
  const dotNow = (await page.locator(".gs-here-dot").boundingBox())!;
  const pinNow = (await page.locator(".ui-pinmap-pin").boundingBox())!;
  if (await tag(page).isVisible()) {
    const t = (await tag(page).boundingBox())!;
    expect(overlap(t, dotNow), "the tag sits under the my-location dot").toBe(false);
    expect(overlap(t, pinNow), "the tag sits under the pin").toBe(false);
  }
});
