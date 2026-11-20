// Story 1528: every order has an exact point. No typed-only place, the Bill keeps the point, the server refuses an order with no point, and an old saved
// address with no point must get its pin first. The tests are named after the story's scenarios.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, phoneAt, toDeliverTo } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };
const OLD = { id: "o1", label: "Old flat", address: "7, Hauz Khas", pin_code: "110016", lat: null, lng: null, last_used_at: "2026-11-01T10:00:00Z" };
const NO_INTERNET = "No internet. Check your internet and try again.";

// The phone is at Home, so Home (a saved address with its pin) is the place and no sheet asks.
async function atHome(context: BrowserContext, page: Page, rows: object[] = [HOME]) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = rows;
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneAt(context, HOME);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();
  return net;
}
async function toBill(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
}
const noTypedForm = async (page: Page) => {
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "See the menu" })).toHaveCount(0);
};

test("No typed-only place: I am a new customer, and the first screen has no box to type an address or a postal code", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.addInitScript(() => { try { localStorage.setItem("gs_alerts_asked", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
  await noTypedForm(page);
});

test("No typed-only place: my place is set and the kitchen cannot be read (no internet): no typed form, a true line, and Try again opens the menu with the point kept", async ({ page, context }) => {
  await setup(context, page, [], { pin: "110016" });
  let down = true;
  await page.route("https://test.supabase.co/rest/v1/kitchens**", (r) => (down ? r.abort("internetdisconnected") : r.fallback()));
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible({ timeout: 20000 });
  await noTypedForm(page);
  await expect(page.getByRole("alert")).toHaveText(NO_INTERNET);
  const again = page.getByRole("button", { name: "Try again" }), search = page.getByRole("button", { name: "Search for my address" });
  const a = (await again.boundingBox())!, s = (await search.boundingBox())!, slip = (await page.locator(".ui-slip").first().boundingBox())!;
  expect(s.y + s.height).toBeLessThanOrEqual(a.y);   // the filled button is last, at the foot of the slip, as on every first-open step
  expect(a.y + a.height).toBeGreaterThan(slip.y + slip.height - 40);
  down = false;
  await again.click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => { const p = JSON.parse(window.localStorage.getItem("gs-place") ?? "null"); return [p.lat, p.lng, p.confirmed]; })).toEqual([28.59, 77.26, true]);
});

test("The Bill keeps the point: my place has a point, I change the house number from the Bill, and the order still carries the point", async ({ page, context }) => {
  const net = await atHome(context, page);
  await toBill(page);
  await page.getByRole("button", { name: "Change address" }).click();   // the Bill's words are not a text box: Change opens Deliver to
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit address" });
  await sheet.getByLabel("House, street, colony, ward").fill("C-5, first floor");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => net.state.addresses[0].house).toBe("C-5, first floor");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("group", { name: "Serving at" })).toContainText("C-5, first floor");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  const sent = net.calls.place[0].body.address;
  expect(sent.text).toContain("C-5, first floor");
  expect([sent.lat, sent.lng]).toEqual([HOME.lat, HOME.lng]);
});

test("The server refuses an order with no point: the order is refused, and the app says how to set the place (Confirm on the map opens the map)", async ({ page, context }) => {
  const net = await atHome(context, page);
  net.state.reply = { status: 422, body: { ok: false, error: "point_required", message: "Set your place on the map to place the order." } };
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toBeEnabled();   // story 1574: the bar itself says what to do
  await expect(page.getByText("Something went wrong")).toHaveCount(0);   // never the catch-all line for this refusal
  await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);
  expect(net.calls.place).toHaveLength(1);
  await page.getByRole("button", { name: "Confirm on the map" }).click();   // the way out is the bar
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
});

test("An old saved address with no point: its row says Set the pin, and it cannot be picked for an order until the pin is set", async ({ page, context }) => {
  const net = await atHome(context, page, [HOME, OLD]);
  await toDeliverTo(page);
  const row = page.getByRole("button", { name: "Old flat has no pin. Set the pin" });
  await expect(row).toContainText("Set the pin");
  await row.click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();   // the tap sets the pin; the row is not picked
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await toBill(page);
  await expect(page.getByRole("group", { name: "Serving at" })).toContainText(HOME.address);   // the place is still Home
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect([net.calls.place[0].body.address.lat, net.calls.place[0].body.address.lng]).toEqual([HOME.lat, HOME.lng]);
});

test("The demo console is not a way around: with no place on the phone, Place order waits and no order is sent", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await page.goto("/console/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toBeEnabled();
  expect(net.calls.place).toHaveLength(0);
});
