// Story 1392 (board A1p-OnboardPin): on a short screen (360 x 640) the Current Location button never covers the pin. The map stays behind the whole card,
// and the place the map reads is the place under the pin, not the middle of the map. At 390 x 844 the pin stays in the middle of the screen, as on the board.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";

const PHONE = { lat: 24.8847, lng: 79.597 };   // the place the step gives the browser
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

for (const [w, h] of [[360, 640], [390, 844]] as const) {
  test(`S1 at ${w} x ${h} the pin is clear of the button, the map is behind the card, and the place read is under the pin`, async ({ page, context }) => {
    const reads: { lat: number; lng: number }[] = [];
    page.on("request", (r) => {
      if (!r.url().includes("/functions/v1/geocode")) return;
      const u = new URL(r.url());
      reads.push({ lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) });
    });
    await page.setViewportSize({ width: w, height: h });
    await STEPS["first-open-pin"](context, page, "/customer/");
    await expect(page.locator(".ui-pinmap-here")).toBeVisible();
    const pin = await box(page, ".ui-pinmap-pin");
    const here = await box(page, ".ui-pinmap-here");
    expect(overlap(pin, here), `pin ${JSON.stringify(pin)} under button ${JSON.stringify(here)}`).toBe(false);
    const map = await box(page, ".ui-pinmap-map");
    const card = await box(page, ".ui-pinmap-card");
    expect(map.y + map.height, "the map runs behind the whole card").toBeGreaterThanOrEqual(card.y + card.height);
    const point = { x: pin.x + pin.width / 2, y: pin.y + pin.height * 0.625 };   // the pin's point: the box is moved up 62.5% of its height
    if (h === 844) expect(Math.abs(point.y - h / 2)).toBeLessThanOrEqual(1);   // a tall screen keeps the board's middle
    await expect.poll(() => reads.length).toBeGreaterThan(0);
    expect(metres(reads[reads.length - 1], PHONE), "the place read is the place under the pin").toBeLessThanOrEqual(2);
  });
}

test("S2 at 360 x 640, Confirm & proceed then Change comes back with the pin on the same place", async ({ page, context }) => {
  const reads: { lat: number; lng: number }[] = [];
  page.on("request", (r) => {
    if (!r.url().includes("/functions/v1/geocode")) return;
    const u = new URL(r.url());
    reads.push({ lat: Number(u.searchParams.get("lat")), lng: Number(u.searchParams.get("lng")) });
  });
  await page.setViewportSize({ width: 360, height: 640 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.locator(".ui-pinmap-here")).toBeVisible();
  await page.waitForTimeout(800);   // let any move settle
  expect(metres(reads[reads.length - 1], PHONE), "the place read after Change").toBeLessThanOrEqual(2);
  const pin = await box(page, ".ui-pinmap-pin");
  expect(overlap(pin, await box(page, ".ui-pinmap-here"))).toBe(false);
});
