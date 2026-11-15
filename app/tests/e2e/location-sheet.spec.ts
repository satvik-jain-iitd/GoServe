// Bug 1526 (board LO-V1, LF-SHEET-Blocked, LF-SHEET-Busy): the sheet "Where to bring your food?". The line is true for the cause (blocked for the app, the phone's
// location is off, too slow), every tap asks again and shows something, and no button is dead. The same true lines show on Deliver to and on the pin map.
import { test, expect, type Page } from "@playwright/test";
import { asked, comeBack, phoneLoc, setLoc, setup, toDeliverTo, type Loc } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "Z-900, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const AT_HOME = { latitude: 28.5690, longitude: 77.2440 };
const sheet = (page: Page) => page.getByRole("dialog", { name: "Where to bring your food?" });
const main = (page: Page) => sheet(page).getByRole("button", { name: "Use my current location" });

async function open(page: Page, context: Parameters<typeof setup>[0], loc: Loc) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME, WORK];
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneLoc(page, loc);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();
  return net;
}

test("The phone's location is off: I tap Try location again, I do not see the word blocked, and a second tap asks again", async ({ page, context }) => {
  await open(page, context, { perm: "granted", pos: 2 });
  await expect(sheet(page)).toBeVisible();
  expect(await asked(page)).toBe(1);   // the one find the app makes by itself
  const main = (p: Page) => sheet(p).getByRole("button", { name: "Try location again" });   // story 1530: after a find that failed the retry is the outline button; search is the filled one
  await main(page).click();
  await expect(sheet(page).getByRole("status")).toHaveText("Your phone's location is off. Pick a place.");
  await expect(sheet(page)).not.toContainText(/blocked/i);
  expect(await asked(page)).toBe(2);
  await main(page).click();
  await expect.poll(() => asked(page)).toBe(3);
  await expect(main(page)).toBeEnabled();
});

test("Location is blocked for the app: no button on the sheet does nothing when tapped", async ({ page, context }) => {
  await open(page, context, { perm: "denied", pos: 1 });
  await expect(sheet(page).getByRole("status")).toHaveText("Location is blocked for GoServe. Pick a place.");
  await expect(main(page)).toHaveCount(0);   // asking a blocked phone is not the main way
  await sheet(page).getByRole("button", { name: "Try location again" }).click();
  await expect(sheet(page).getByRole("status")).toContainText("Still blocked. In your phone: Settings");   // the tap says something new
  await sheet(page).getByRole("button", { name: /Work/ }).click();   // a saved address picks it
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Work\b/ }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Work\b/ }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(sheet(page)).toHaveCount(0);   // story 1547: Work is the place on this phone now, so the sheet does not open by itself again
  await page.evaluate(() => { localStorage.removeItem("gs-place"); localStorage.removeItem("gs-pin"); });   // a phone with no place again
  await page.reload();
  await sheet(page).getByRole("button", { name: "Search your area" }).click();   // the filled button opens the search
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
});

test("I fix it and come back: the sheet closes without a tap", async ({ page, context }) => {
  await open(page, context, { perm: "denied", pos: 1 });
  await expect(sheet(page)).toBeVisible();
  await setLoc(page, { perm: "granted", pos: AT_HOME });   // turned on in the phone's settings
  await comeBack(page);
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();
});

test("A tap always shows something: the button says Finding you… until the phone answers", async ({ page, context }) => {
  await open(page, context, { perm: "prompt", pos: "never" });
  await expect(sheet(page).getByRole("status")).toHaveText("We can't see where you are right now. Pick a place.");
  await main(page).click();
  const busy = sheet(page).getByRole("button", { name: "Finding you…" });
  await expect(busy).toBeVisible();
  await expect(busy).toBeDisabled();
});

test("Finding the phone takes too long: the line says so, and never says blocked", async ({ page, context }) => {
  await open(page, context, { perm: "granted", pos: 3 });
  await expect(sheet(page).getByRole("status")).toHaveText("Finding you is taking too long. Pick a place.");
  await expect(sheet(page).getByRole("button", { name: "Try location again" })).toBeEnabled();   // story 1530: the retry is the outline button after a find that failed
});

test("The sheet: the picked address carries a tick, two rows show, and View all opens Deliver to", async ({ page, context }) => {
  await open(page, context, { perm: "prompt", pos: "never" });
  await expect(sheet(page).getByRole("heading", { name: "Where to bring your food?" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: /^Home\b/ })).toHaveAttribute("aria-current", "true");
  await expect(sheet(page).getByRole("button", { name: /^Work\b/ })).not.toHaveAttribute("aria-current", "true");
  const buttons = await sheet(page).getByRole("button").allTextContents();
  expect(buttons.slice(-2)).toEqual(["Search your area", "Use my current location"]);   // the filled button is last
  await sheet(page).getByRole("button", { name: "View all" }).click();
  await expect(page.getByRole("heading", { name: "Deliver to" })).toBeVisible();
});

test("The sheet never opens over the first-open screen", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await phoneLoc(page, { perm: "denied", pos: 1 });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Deliver to, Use current location: the card says Finding you…, then the box says the true line, and no map opens by itself", async ({ page, context }) => {
  await open(page, context, { perm: "prompt", pos: "never" });
  await sheet(page).getByRole("button", { name: "View all" }).click();
  const box = page.getByRole("region", { name: "Delivering to" });
  await expect(box).toContainText("We can't see where you are right now");
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(page.getByRole("button", { name: "Finding you…" })).toBeDisabled();
  await page.reload();
  await toDeliverTo(page);   // story 1547: Home is the place on this phone now, so no sheet opens; the place at the top opens Deliver to
  await setLoc(page, { perm: "granted", pos: 2 });
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(box).toContainText("Your phone's location is off");
  await expect(page.getByRole("region", { name: "Pin map" })).toHaveCount(0);
  await setLoc(page, { perm: "granted", pos: AT_HOME });
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();   // found: the map opens at the phone, as before
});

test("The pin map, Current Location: the line is true for the cause", async ({ page, context }) => {
  await open(page, context, { perm: "prompt", pos: 3 });
  await sheet(page).getByRole("button", { name: "View all" }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await page.getByRole("button", { name: /Current location/i }).click();
  await expect(page.getByText("Finding you is taking too long. Try again, or move the map to your place.")).toBeVisible();
  await expect(page.getByText(/Allow location/)).toHaveCount(0);
});
