// Stories 1379, 1380, 1381 (board A1d-LocationRiderWaits) and 1384 (board A1e-LocationRiderLeaves), owner's yes on 13 Nov 2026.
// The location ask says why, its buttons say what they do, a rider rides in once and waits in the lane under the pin. After the first Save address,
// the same slip says "Finding your kitchen" while the kitchen is found, and the rider rides out to the right (0.8 s) before the menu shows.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { setup } from "./helpers";

const rider = (page: Page) => page.locator(".ui-ride");
const anim = (page: Page) => rider(page).evaluate((e) => { const c = getComputedStyle(e); return { name: c.animationName, count: c.animationIterationCount }; });

async function firstOpen(context: BrowserContext, page: Page) {
  await setup(context, page, [], { pin: null });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ address: { road: "Lajpat Nagar II", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } }) }));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
}
// Holds the kitchens read until the test lets it go, so the wait after Save address can be seen.
async function holdKitchens(page: Page) {
  let let_go!: () => void;
  const gate = new Promise<void>((r) => { let_go = r; });
  await page.route("https://test.supabase.co/rest/v1/kitchens**", async (route: Route) => { await gate; await route.fallback(); });
  return let_go;
}
async function saveFirstAddress(page: Page) {
  await page.getByRole("button", { name: "Use my current location" }).click();
  const confirm = page.getByRole("button", { name: "Confirm & proceed" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.getByLabel("House, street, colony, ward").fill("B-12, ground floor");
  await page.getByRole("button", { name: "Save address" }).click();
}

test("L1 (1379, 1380) the reason line and the two buttons that say what they do", async ({ page, context }) => {
  await firstOpen(context, page);
  await page.goto("/customer/");
  const slip = page.getByRole("group", { name: "Your address" });
  await expect(slip.getByText("We use it only to find your address and the kitchen near you.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use my current location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search for my address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set " + "delivery location" })).toHaveCount(0);   // the old words, split so a rename across the tests leaves them
  await expect(page.getByRole("button", { name: "Enter " + "address manually" })).toHaveCount(0);
});

test("L2 (1381) the rider rides in once under the pin and waits there, hidden from screen readers, between the pin and the buttons", async ({ page, context }) => {
  await firstOpen(context, page);
  await page.goto("/customer/");
  await expect(page.locator(".ui-lane")).toHaveAttribute("aria-hidden", "true");
  expect(await anim(page)).toEqual({ name: "ui-ride-in", count: "1" });
  await page.waitForTimeout(1500);   // the ride in has ended
  const pin = (await page.locator(".ui-pinbadge").boundingBox())!;
  const bike = (await rider(page).boundingBox())!;
  const ghost = (await page.getByRole("button", { name: "Search for my address" }).boundingBox())!;
  expect(Math.abs(bike.x + bike.width / 2 - (pin.x + pin.width / 2))).toBeLessThanOrEqual(3);   // in the centre, under the pin
  expect(bike.y).toBeGreaterThanOrEqual(pin.y + pin.height);
  expect(bike.y + bike.height).toBeLessThanOrEqual(ghost.y - 8);
});

test("L3 (1381) reduce motion: the rider stands in the centre, nothing moves", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await firstOpen(context, page);
  await page.goto("/customer/");
  expect((await anim(page)).name).toBe("none");
  const pin = (await page.locator(".ui-pinbadge").boundingBox())!;
  const bike = (await rider(page).boundingBox())!;
  expect(Math.abs(bike.x + bike.width / 2 - (pin.x + pin.width / 2))).toBeLessThanOrEqual(3);
  expect(await page.locator(".ui-lane *").evaluateAll((els) => els.filter((e) => getComputedStyle(e).animationName !== "none").length)).toBe(0);
});

for (const [w, h] of [[360, 649], [360, 780], [390, 844]]) {
  test(`L4 at ${w} by ${h} the lane sits between the pin and the buttons and the page does not scroll`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await firstOpen(context, page);
    await page.goto("/customer/");
    await page.waitForTimeout(1500);
    const lane = page.locator(".ui-lane");
    if (await lane.isVisible()) {
      const box = (await lane.boundingBox())!;
      const pin = (await page.locator(".ui-pinbadge").boundingBox())!;
      const ghost = (await page.getByRole("button", { name: "Search for my address" }).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(pin.y + pin.height);
      expect(box.y + box.height).toBeLessThanOrEqual(ghost.y - 8);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(false);
  });
}

test("L5 (1384) first set-up: after Save address the slip says Finding your kitchen, the rider waits in the centre, no grey waiting box", async ({ page, context }) => {
  await firstOpen(context, page);
  await page.goto("/customer/");
  const letGo = await holdKitchens(page);
  await saveFirstAddress(page);
  await expect(page.getByRole("heading", { name: "Finding your kitchen" })).toBeVisible();
  await expect(page.getByText("Your address is saved. The menu opens in a moment.")).toBeVisible();
  await expect(page.locator(".ui-skel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use my current location" })).toHaveCount(0);   // no buttons on this slip
  await expect(rider(page)).toBeVisible();
  await expect(rider(page)).not.toHaveClass(/out/);
  letGo();
  await expect(rider(page)).toHaveClass(/out/);   // the kitchen is found: he rides out
  expect((await anim(page)).name).toBe("ui-ride-out");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Finding your kitchen" })).toHaveCount(0);
});

test("L6 (1384) reduce motion: the rider stands still and the menu shows as soon as the kitchen is found", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await firstOpen(context, page);
  await page.goto("/customer/");
  const letGo = await holdKitchens(page);
  await saveFirstAddress(page);
  await expect(page.getByRole("heading", { name: "Finding your kitchen" })).toBeVisible();
  expect((await anim(page)).name).toBe("none");
  letGo();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible({ timeout: 2000 });
});

test("L7 (1384) a returning customer with a saved address never sees Finding your kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [{ id: "h1", label: "Home", address: "C-128, Green Avenue Colony", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" }];
  const seen: boolean[] = [];
  await page.goto("/customer/");
  for (let i = 0; i < 10; i++) { seen.push(await page.getByRole("heading", { name: "Finding your kitchen" }).isVisible()); await page.waitForTimeout(50); }
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(seen.some(Boolean)).toBe(false);
});

test("L8 (1384) bad network: the kitchens read keeps failing after Save address: once the reads give up (about 7 s of retries) the rider slip gives way to the location ask, it never hangs", async ({ page, context }) => {
  await firstOpen(context, page);
  await page.goto("/customer/");
  await page.route("https://test.supabase.co/rest/v1/kitchens**", (route) => route.abort("internetdisconnected"));
  await saveFirstAddress(page);
  await expect(page.getByRole("heading", { name: "Finding your kitchen" })).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
});
