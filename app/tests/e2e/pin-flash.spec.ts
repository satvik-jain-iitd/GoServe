// Story 1393 (board A1p-OnboardPin): a screen size change on a served pin must never flash a false "Not in our area yet".
// The server answers a place with no pin as not served (it decides by pin code); the answer with the pin the map read is the true one.
import { test, expect } from "@playwright/test";
import { STEPS } from "./screensSteps";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json" };
const SERVED = { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-1", name: "Chhatarpur Kitchen", distance_m: 1230, eta_min: 30, open: true }] };
const NOT = { ok: true, serviceable: false, request_here: true, kitchens: [] };

test("S1 changing the screen size on a served pin never shows Not in our area yet, and the pin is not looked up again", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  const serves: string[] = [];
  await context.route("https://test.supabase.co/functions/v1/serviceability**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = route.request().url();
    serves.push(url);
    const withPin = new URL(url).searchParams.has("pin");
    if (withPin) await new Promise((r) => setTimeout(r, 300));   // the pin answer comes last, as on dev
    return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(withPin ? SERVED : NOT) });
  });
  await page.evaluate(() => {
    const w = window as unknown as { sawRed: boolean };
    w.sawRed = false;
    new MutationObserver(() => { if (document.body.innerText.includes("Not in our area yet")) w.sawRed = true; }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  for (const [w, h] of [[390, 844], [360, 640], [390, 844], [360, 640]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1200);
  }
  expect(await page.evaluate(() => (window as unknown as { sawRed: boolean }).sawRed)).toBe(false);
  await expect(page.getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
  expect(serves).toEqual([]);   // the place under the pin did not change: no new lookup
});

test("S2 a place where the pin cannot be read: the place-only answer still shows Not in our area yet", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  await context.route("https://test.supabase.co/functions/v1/geocode**", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 500, headers: CORS, body: "{}" }));
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(NOT) }));
  const map = (await page.getByRole("application", { name: "Map" }).boundingBox())!;
  await page.mouse.move(map.x + map.width / 2, map.y + 200);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width / 2 + 120, map.y + 260, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Not in our area yet")).toBeVisible();
});

// Review of PR #1425: a failed ask is asked again, and a lookup that never answers does not hide the place-only answer for good.
test("S3 asks that failed are asked again: network down, Current Location, network back, Current Location shows the new place", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  let down = true, looks = 0;
  await context.route("https://test.supabase.co/functions/v1/geocode**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    looks++;
    return down ? route.abort() : route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ ok: true, address: "Radio Colony, Chhatarpur, Madhya Pradesh 471001", pin: "471001", locality: "Radio Colony", town: "Chhatarpur" }) });
  });
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : down ? route.abort() : route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(SERVED) }));
  await context.setGeolocation({ latitude: 24.8901, longitude: 79.6012 });
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect.poll(() => looks).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  down = false;
  const before = looks;
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect.poll(() => looks).toBeGreaterThan(before);
  await expect(page.getByText("Radio Colony", { exact: false }).first()).toBeVisible();
});

test("S4 a lookup that never answers: after the wait the place-only answer stands (Not in our area yet)", async ({ page, context }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  await context.route("https://test.supabase.co/functions/v1/geocode**", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : undefined);   // never answers
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(NOT) }));
  const map = (await page.getByRole("application", { name: "Map" }).boundingBox())!;
  await page.mouse.move(map.x + map.width / 2, map.y + 200);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width / 2 + 120, map.y + 260, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Not in our area yet")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^We deliver here/)).toHaveCount(0);
});
