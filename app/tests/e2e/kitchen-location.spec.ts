// Story #905, board A-AddKitchen-Pin (A10): the admin sets a kitchen's location with the phone's place and a draggable pin. No search box, no geocoding.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const HERE = { latitude: 28.5677, longitude: 77.2432, accuracy: 25 };
const addForm = async (page: Page) => {
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "+ Add a kitchen" }).click();
};
const line = (page: Page) => page.getByTestId("location-line");

test("S1 Use my phone's location sets the pin and the line; Add kitchen saves lat, lng and accuracy", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
  await addForm(page);
  const block = page.getByRole("region", { name: "Location" });
  await expect(block).toContainText("No location yet");
  await block.getByRole("button", { name: "Use my phone's location here" }).click();
  await expect(line(page)).toContainText("28.56770, 77.24320");
  await expect(line(page)).toContainText("±25 m");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await page.getByLabel("Kitchen name").fill("Chhatarpur Kitchen");
  await page.getByLabel("Pin codes").fill("110074");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBeGreaterThan(0);
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ name: "Chhatarpur Kitchen", lat: 28.5677, lng: 77.2432, location_accuracy_m: 25 });
  expect(typeof net.calls.kitchenWrites[0].body.location_at).toBe("string");
});

test("S2 dragging the pin changes the saved values", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
  await addForm(page);
  await page.getByRole("button", { name: "Use my phone's location here" }).click();
  await expect(line(page)).toContainText("28.56770, 77.24320");
  const pin = page.locator(".leaflet-marker-icon");
  const b = (await pin.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await expect(line(page)).not.toContainText("28.56770, 77.24320");
  await expect(line(page)).toContainText("moved by hand");
  await page.getByLabel("Kitchen name").fill("Chhatarpur Kitchen");
  await page.getByLabel("Pin codes").fill("110074");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBeGreaterThan(0);
  const body = net.calls.kitchenWrites[0].body;
  expect(body.lat).not.toBe(28.5677);
  expect(body.location_accuracy_m).toBeNull();   // a hand-placed pin has no phone accuracy
});

test("S3 a kitchen with no location says so on its page, and one with a location shows the saved line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = [
    { id: "k-1", name: "Tau Ka Dhaba", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: null, closes_at: null, lat: null, lng: null, location_accuracy_m: null, location_at: null },
    { id: "k-2", name: "Rohini Kitchen", address: null, phone: null, pin_codes: ["110085"], open: true, active: true, opens_at: null, closes_at: null, lat: 28.7, lng: 77.1, location_accuracy_m: 12, location_at: "2026-11-06T09:00:00Z" },
  ];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await expect(page.getByText("No location yet. Nearest rider cannot be picked.")).toBeVisible();
  await page.getByRole("button", { name: "Back to city" }).click();
  await page.getByRole("button", { name: /^Open kitchen Rohini Kitchen/ }).click();
  await expect(page.getByText("No location yet")).toHaveCount(0);
  await expect(line(page)).toContainText("28.70000, 77.10000 · ±12 m · 6 Nov");
});

test("S4 on a kitchen page Use my phone's location saves at once with an update, not an insert", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = [{ id: "k-1", name: "Tau Ka Dhaba", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: null, closes_at: null, lat: null, lng: null, location_accuracy_m: null, location_at: null }];
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await page.getByRole("button", { name: "Use my phone's location here" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].method).toBe("PATCH");
  expect(net.calls.kitchenWrites[0].url).toContain("id=eq.k-1");
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ lat: 28.5677, lng: 77.2432, location_accuracy_m: 25 });
});

test("S5 when the phone cannot give its place the line says so in plain words and nothing is saved", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await addForm(page);   // location is not allowed in this context
  await page.getByRole("button", { name: "Use my phone's location here" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not get the phone's location. Allow location, or tap the map to place the pin.");
  expect(net.calls.kitchenWrites).toEqual([]);
});
