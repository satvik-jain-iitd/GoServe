// Story #1500 (way B): the pin costs no Ola call while it moves or rests. The address is looked up once, on Confirm & proceed.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const NO = { status: 200, body: { ok: true, serviceable: false, request_here: true, kitchens: [] } };

async function toMap(page: Page, context: Parameters<typeof setup>[0], over: { geocode?: { status: number; body: object }; serve?: { status: number; body: object } } = {}) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.geocode = over.geocode ?? { status: 200, body: GREEN_PARK };
  if (over.serve) net.state.serve = over.serve;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 28.56, longitude: 77.2 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(confirm(page)).toBeEnabled();
  return net;
}
const screen = (page: Page) => page.getByRole("region", { name: "Pin map" });
const confirm = (page: Page) => page.getByRole("button", { name: "Confirm & proceed" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Address details" });
async function drag(page: Page, dx: number) {
  const b = (await page.locator(".ui-pinmap-map").boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2 - 100;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y, { steps: 6 }); await page.mouse.up();
}

test("Moving the pin makes no Ola call", async ({ page, context }) => {
  const net = await toMap(page, context);
  for (let i = 0; i < 10; i++) {
    const before = net.calls.serve.length;
    await drag(page, i % 2 ? 60 : -60);
    await expect.poll(() => net.calls.serve.length).toBeGreaterThan(before);   // the pin rested: our own answer was asked
  }
  await expect(confirm(page)).toBeEnabled();
  await expect(screen(page).getByText("Pin on the map")).toBeVisible();
  expect(net.calls.geocode).toHaveLength(0);
});

test("Opening the map and Current Location make no Ola call", async ({ page, context }) => {
  const net = await toMap(page, context);
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect(confirm(page)).toBeEnabled();
  await expect(screen(page).getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible();   // our own yes shows at once
  expect(net.calls.geocode).toHaveLength(0);
});

test("Confirm makes exactly one Ola call", async ({ page, context }) => {
  const net = await toMap(page, context);
  expect(net.calls.geocode).toHaveLength(0);   // nothing before the tap
  await confirm(page).click();
  await expect(sheet(page)).toContainText("Green Park");
  await expect(sheet(page)).toContainText("New Delhi, Delhi");
  await expect(sheet(page).getByLabel("Area or street")).toHaveCount(0);
  expect(net.calls.geocode).toHaveLength(1);
});

test("A no is said only after the lookup", async ({ page, context }) => {
  const net = await toMap(page, context, { serve: NO });
  await expect(screen(page).getByText("Pin on the map")).toBeVisible();
  await expect(page.getByText("Not in our area yet")).toHaveCount(0);
  await confirm(page).click();
  await expect(page.getByText("Not in our area yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite the founders here" })).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  expect(net.calls.geocode).toHaveLength(1);
  expect(net.calls.serve.at(-1)).toContain("pin=110016");   // the no is the answer with Ola's postal code
});

test("Ola does not answer", async ({ page, context }) => {
  const net = await toMap(page, context, { geocode: { status: 503, body: { ok: false, error: "provider_off" } } });
  expect(net.calls.geocode).toHaveLength(0);
  await confirm(page).click();
  await expect(sheet(page).getByLabel("Area or street")).toBeVisible();
  await expect(sheet(page).getByLabel("Pin code")).toBeVisible();
  expect(net.calls.geocode).toHaveLength(1);
});

test("The same place is not looked up twice", async ({ page, context }) => {
  const net = await toMap(page, context);
  await confirm(page).click();
  await expect(sheet(page)).toContainText("Green Park");
  await sheet(page).getByRole("button", { name: "Change" }).click();
  await confirm(page).click();
  await expect(sheet(page)).toContainText("Green Park");
  expect(net.calls.geocode).toHaveLength(1);
});
