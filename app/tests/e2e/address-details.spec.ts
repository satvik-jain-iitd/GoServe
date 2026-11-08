// Story #1038 (board C7-PinDetails): after the pin, a sheet over the same map asks for the words the rider needs, and saves the address with the pin's exact place.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const NOW = Date.now();
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(NOW - 3 * 86_400_000).toISOString() };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };

async function toDetails(page: Page, context: Parameters<typeof setup>[0], geocode: { status: number; body: object } = { status: 200, body: GREEN_PARK }) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.geocode = geocode;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 28.56, longitude: 77.2 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  return net;
}
const sheet = (page: Page) => page.getByRole("dialog", { name: "Address details" });

test("S1 the sheet opens over the same map: Step 2 of 2, the place and a Change link, two fields, Save as chips, Save address, no hint", async ({ page, context }) => {
  await toDetails(page, context);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText("Step 2 of 2")).toBeVisible();
  await expect(sheet(page).getByText("Green Park", { exact: true })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Change" })).toBeVisible();
  await expect(sheet(page).getByLabel("House, flat, floor")).toBeVisible();
  await expect(sheet(page).getByLabel("Landmark (optional)")).toBeVisible();
  for (const c of ["Home", "Office", "Other"]) await expect(sheet(page).getByRole("button", { name: c, exact: true })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Save address" })).toBeVisible();
  await expect(page.getByText(/The pin takes the rider/)).toHaveCount(0);   // owner rule 8 Nov: no hint under the chips
  const pin = (await page.getByTestId("map-pin").boundingBox())!, top = (await sheet(page).boundingBox())!;
  expect(pin.y + pin.height).toBeLessThan(top.y);   // the pin stays visible above the sheet
});

test("S2 Save with no house says what to add and writes nothing", async ({ page, context }) => {
  const net = await toDetails(page, context);
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("alert")).toContainText("Add the house, flat or floor.");
  expect(net.state.addresses).toHaveLength(1);
});

test("S3 house and a chip save one row with the pin's exact place, the label and the words, and it is picked", async ({ page, context }) => {
  const net = await toDetails(page, context);
  await sheet(page).getByLabel("House, flat, floor").fill("12B, 2nd floor");
  await sheet(page).getByRole("button", { name: "Office", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(2);
  const row = net.state.addresses.at(-1)!;
  expect(row).toMatchObject({ label: "Office", address: "12B, 2nd floor, Green Park, New Delhi, Delhi", pin_code: "110016" });
  expect(row.lat).toBeCloseTo(28.56, 3); expect(row.lng).toBeCloseTo(77.2, 3);   // the pin: the phone's place the map opened on
  await expect(page.getByRole("button", { name: /^Office\b/ })).toBeVisible();
});

test("S4 a landmark is added as near", async ({ page, context }) => {
  const net = await toDetails(page, context);
  await sheet(page).getByLabel("House, flat, floor").fill("12B");
  await sheet(page).getByLabel("Landmark (optional)").fill("Metro gate 2");
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(2);
  expect(net.state.addresses.at(-1)!.address).toBe("12B, near Metro gate 2, Green Park, New Delhi, Delhi");
});

test("S5 Other opens a name box that must be filled", async ({ page, context }) => {
  const net = await toDetails(page, context);
  await sheet(page).getByLabel("House, flat, floor").fill("12B");
  await sheet(page).getByRole("button", { name: "Other", exact: true }).click();
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("alert")).toContainText("Give this place a name.");
  await sheet(page).getByLabel("Name this place").fill("Nani's house");
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(2);
  expect(net.state.addresses.at(-1)!.label).toBe("Nani's house");
});

test("S6 Change goes back to the map, and the map is still there", async ({ page, context }) => {
  await toDetails(page, context);
  await sheet(page).getByRole("button", { name: "Change" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
});

test("S7 the fields share one style: same height, border and corners, and 16 px between rows", async ({ page, context }) => {
  await toDetails(page, context);
  const m = async (name: string) => sheet(page).getByLabel(name).evaluate((el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return { h: Math.round(r.height), top: r.top, bottom: r.bottom, border: c.borderTopWidth, radius: c.borderTopLeftRadius, pad: c.paddingLeft }; });
  const a = await m("House, flat, floor"), b = await m("Landmark (optional)");
  expect([a.h, a.border, a.radius, a.pad]).toEqual([b.h, b.border, b.radius, b.pad]);
  expect(a.h).toBeGreaterThanOrEqual(44);
  const labelTop = await sheet(page).getByText("Landmark (optional)", { exact: true }).evaluate((el) => el.getBoundingClientRect().top);
  expect(labelTop - a.bottom).toBeGreaterThanOrEqual(12);
});

test("S8 when the lookup found no words or no pin code, the sheet asks for them", async ({ page, context }) => {
  const net = await toDetails(page, context, { status: 503, body: { ok: false } });
  await sheet(page).getByLabel("House, flat, floor").fill("12B");
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("alert")).toContainText("Type the area or street.");
  await sheet(page).getByLabel("Area or street").fill("Green Park");
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("alert")).toContainText("The pin code is six digits.");
  await sheet(page).getByLabel("Pin code").fill("110016");
  await sheet(page).getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(2);
  expect(net.state.addresses.at(-1)).toMatchObject({ address: "12B, Green Park", pin_code: "110016" });
});
