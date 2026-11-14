// Story 1532: one stored delivery place (the point, the words, the postal code, the house and a confirmed mark). The point no longer lives only in memory:
// a reload, an open order, an edit and a failed save all keep it. A place that was not confirmed on the pin map cannot be ordered to. The address is never a free text box.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { order, setup } from "./helpers";
import { firstOpenToMenu } from "./firstOpen";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const placeOf = (over: object) => ({ address: HOME.address, pin: "110016", lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: true, id: null, ...over });

// What the app itself leaves in the phone: the place, and the postal code beside it for the kitchen it remembers. Only when nothing is there, so a reload keeps what the app wrote.
const stored = (context: BrowserContext, place: object) => context.addInitScript((p) => {
  if (window.localStorage.getItem("gs-place")) return;
  window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin);
}, place);
const map = async (context: BrowserContext, net: Awaited<ReturnType<typeof setup>>) => {
  net.state.geocode = { status: 200, body: GREEN_PARK };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
};
async function toBill(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
}
async function placeOrder(page: Page) {
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}

test("The place survives a reload: I reload on the Bill and the order still carries the point", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await page.goto("/customer/");
  await toBill(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await placeOrder(page);
  expect(net.calls.place).toHaveLength(1);
  expect(net.calls.place[0].body.address).toMatchObject({ pin_code: "110016", text: HOME.address });
  expect(net.calls.place[0].body.address.lat).toBeCloseTo(HOME.lat, 4);
  expect(net.calls.place[0].body.address.lng).toBeCloseTo(HOME.lng, 4);
});

test("A raw fix is not enough: Place order waits and I see Confirm on the map; after Confirm & proceed the order carries the point", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await map(context, net);
  await stored(context, placeOf({ address: "Where you are now", confirmed: false }));
  await page.goto("/customer/");
  await toBill(page);
  await expect(page.getByText("Where you are now")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Confirm your place on the map to place the order." })).toBeVisible();
  await page.getByRole("button", { name: "Confirm on the map" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await page.getByLabel("House, street, colony, ward").fill("B-12, ground floor");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();   // back on the Bill, with the cart
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toHaveCount(0);
  await placeOrder(page);
  expect(net.calls.place[0].body.address.text).toContain("B-12, ground floor");
  expect(net.calls.place[0].body.address.lat).toBeCloseTo(HOME.lat, 3);
  expect(net.calls.place[0].body.address.lng).toBeCloseTo(HOME.lng, 3);
});

test("No free text for the address: the Bill and the You screen show the words, and Change opens Deliver to", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await page.goto("/customer/");
  await toBill(page);
  await expect(page.locator("#address")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Deliver to" })).toContainText(HOME.address);
  await page.getByRole("button", { name: "Change address" }).click();
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("group", { name: "Deliver to" })).toContainText(HOME.address);
  await page.getByRole("button", { name: "Edit delivery details" }).click();
  await expect(page.locator("[id=acc-name]")).toBeVisible();
  await expect(page.locator("[id=acc-address]")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveCount(0);
  await page.getByRole("button", { name: "Change address" }).click();
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
});

test("An app open on an open order keeps the point: the next order from the menu carries it", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery")], { pin: null });
  net.state.addresses = [HOME];
  await context.route("**/rest/v1/addresses**", async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.fallback(); });   // the saved list answers after the tracker opened
  await stored(context, placeOf({ id: "h1" }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Back to menu" }).click();   // the tracker opened by itself; its chevron
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect.poll(() => net.calls.place.length).toBe(1);   // the tracker then shows the test's one order again, On the way
  expect(net.calls.place[0].body.address.lat).toBeCloseTo(HOME.lat, 4);
  expect(net.calls.place[0].body.address.lng).toBeCloseTo(HOME.lng, 4);
});

test("An edit of the picked saved address keeps the point", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await map(context, net);
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).first().click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit address" });
  await sheet.getByLabel("House, street, colony, ward").fill("C-5, first floor");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => net.state.addresses[0].house).toBe("C-5, first floor");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await toBill(page);
  await placeOrder(page);
  expect(net.calls.place[0].body.address.text).toContain("C-5, first floor");
  expect(net.calls.place[0].body.address.lat).toBeCloseTo(HOME.lat, 3);
  expect(net.calls.place[0].body.address.lng).toBeCloseTo(HOME.lng, 3);
});

test("A failed save keeps the point: the address could not be saved, the order still carries the pin", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await map(context, net);
  await context.route("**/rest/v1/addresses**", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ message: "down" }) }) : r.fallback()));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await page.goto("/customer/");
  await firstOpenToMenu(page);
  await toBill(page);
  await placeOrder(page);
  expect(net.calls.place[0].body.address.lat).toBeCloseTo(28.5677, 3);
  expect(net.calls.place[0].body.address.lng).toBeCloseTo(77.2432, 3);
  await page.reload();   // and it is still there after a reload
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("gs-place") ?? "null")?.confirmed)).toBe(true);
});

test("No Home row with no point: an old typed place makes no saved row, and it must be confirmed on the map", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await context.addInitScript(() => {   // what a build before this story left: the postal code and the typed words, no point
    window.localStorage.setItem("gs-pin", "110016");
    window.localStorage.setItem("gs-draft", JSON.stringify({ step: "menu", cart: {}, address: "Flat 4, Green Park", name: "", phone: "" }));
  });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(net.calls.addressWrites.filter((w) => w.method === "POST")).toHaveLength(0);
  await toBill(page);
  await expect(page.getByRole("group", { name: "Deliver to" })).toContainText("Flat 4, Green Park");
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
});
