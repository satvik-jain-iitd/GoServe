// Story 1734 (owner, 20 Nov 2026): the Serving at card has no label of its own, a one-line title and a one-line second line (cut with an ellipsis),
// and one height in every state. The two blocked-location messages use the short line. Measured in a real browser, at 360 and 390 wide.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { phoneLoc, setLoc, setup, whereBox } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const AWAY = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home
const hereAway = (context: BrowserContext) => context.addInitScript((p) => { window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", p.pin); },
  { address: "Where you are now", pin: "110016", lat: AWAY.latitude, lng: AWAY.longitude, house: "", landmark: "", confirmed: false, id: null });
const card = (page: Page) => page.getByRole("region", { name: "Serving at" });

async function open(page: Page, context: BrowserContext, w: number) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await hereAway(context);
  await phoneLoc(page, { perm: "granted", pos: AWAY });
  await page.setViewportSize({ width: w, height: 844 });
  await page.goto("/customer/");
  await whereBox(page).getByRole("button", { name: "Use another address" }).click();
  await expect(card(page)).toBeVisible();
}
const height = async (page: Page) => Math.round((await card(page).boundingBox())!.height);
const oneLine = (page: Page, cls: string) => card(page).locator(cls).evaluate((e) => ({ h: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight), over: e.scrollWidth > e.clientWidth }));

for (const w of [360, 390]) {
  test(`AC-1 the card has no small "Serving at" label of its own; the section keeps its name (${w})`, async ({ page, context }) => {
    await open(page, context, w);
    await expect(card(page).locator(".ui-saved-head")).toHaveCount(0);
    await expect(card(page).getByText("Serving at", { exact: true })).toHaveCount(0);
  });

  test(`AC-2 AC-3 AC-5 the card keeps one height and two single lines in the place state and in every location message (${w})`, async ({ page, context }) => {
    await open(page, context, w);
    const seen: Record<string, number> = { place: await height(page) };
    const again = page.getByRole("button", { name: "Use current location" });
    const line = async (name: string, title: string) => {
      await expect(card(page)).toContainText(title);
      seen[name] = await height(page);
      for (const cls of [".ui-going-title", ".ui-going-sub"]) { const m = await oneLine(page, cls); expect(m.h, `${name} ${cls}`).toBeLessThan(m.line * 1.5); }
    };
    await setLoc(page, { perm: "denied", pos: 1 }); await again.click();
    await line("denied", "Location is off or blocked");
    await expect(card(page)).toContainText("Turn it on in settings, or search above.");
    expect((await oneLine(page, ".ui-going-sub")).over, "the short line is not cut").toBe(false);
    await again.click();
    await line("still", "Still off or blocked");
    await expect(card(page)).toContainText("Turn it on in settings, or search above.");
    expect((await oneLine(page, ".ui-going-sub")).over, "the short line is not cut").toBe(false);
    await setLoc(page, { perm: "granted", pos: 2 }); await again.click();
    await line("off", "Your phone's location is off");
    await setLoc(page, { perm: "granted", pos: 3 }); await again.click();
    await line("slow", "Finding you is taking too long");
    await setLoc(page, { perm: "granted", pos: 99 as never }); await again.click();
    await line("none", "We could not find where you are");
    expect(new Set(Object.values(seen)).size, JSON.stringify(seen)).toBe(1);
    expect(seen.place).toBeLessThanOrEqual(80);
  });
}
