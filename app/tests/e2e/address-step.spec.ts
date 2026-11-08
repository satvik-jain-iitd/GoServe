// Story #668 (layer D of #655; boards A1, A2, A3): the first question is where the food goes, not a pin code. The customer's own address is shown; the kitchen stays back-end.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const NOMINATIM = { display_name: "B-12, Lajpat Nagar II, New Delhi, 110016, India", address: { house_number: "B-12", road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } };
const ask = (page: Page) => page.getByRole("heading", { name: "Where does the food go?" });

test("S1 the first question is where the food goes, with two ways to answer", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(ask(page)).toBeVisible();
  await expect(page.getByText("We have multiple kitchens with hygienic homely food")).toBeVisible();   // story #1044: the line under the heading
  await expect(page.getByRole("button", { name: "Use my location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Type it by hand" })).toBeVisible();
  await expect(page.getByLabel("Pin code")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Hauz Khas Kitchen");
});

test("S2 with location allowed Use my location opens the pin map at the phone; Confirm, details and Save open the menu with the address on the bill; the kitchen is never named", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.geocode = { status: 200, body: { ok: true, address: "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi, Delhi", pin: "110016", locality: "Lajpat Nagar", town: "New Delhi" } };
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByText("B-12", { exact: false }).first()).toBeVisible();   // the words of the pin
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await page.getByLabel("House, flat, floor").fill("B-12, near the park gate");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Hauz Khas Kitchen");   // the kitchen is back-end information
  await expect(page.getByText(/Open till/)).toBeVisible();
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue(/near the park gate/);
});

test("S3 without location the customer types the address and pin; See the menu waits for both", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Type it by hand" }).click();
  await expect(ask(page)).toBeVisible();
  const go = page.getByRole("button", { name: "See the menu" });
  await expect(go).toBeDisabled();
  await page.getByLabel("Address", { exact: true }).fill("Flat 4, Green Park");
  await expect(go).toBeDisabled();
  await page.getByLabel("Pin code").fill("110016");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S4 location not given: the search opens, and a picked place lands on the same pin map", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();   // not allowed in this context
  await expect(page.getByRole("searchbox", { name: "Search an area or address" })).toBeVisible();
});
