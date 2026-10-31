// Story #668 (layer D of #655; boards A1, A2, A3): the first question is where the food goes, not a pin code. The customer's own address is shown; the kitchen stays back-end.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const NOMINATIM = { display_name: "B-12, Lajpat Nagar II, New Delhi, 110016, India", address: { house_number: "B-12", road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } };
const ask = (page: Page) => page.getByRole("heading", { name: "Where does the food go?" });

test("S1 the first question is where the food goes, with two ways to answer", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(ask(page)).toBeVisible();
  await expect(page.getByText("Allow location and we fill in your address. You can fix it before the menu opens.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use my location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Type it by hand" })).toBeVisible();
  await expect(page.getByLabel("Pin code")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Hauz Khas Kitchen");
});

test("S2 with location allowed the address is found, can be fixed, and the menu opens with it on the bill; the kitchen is never named", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(NOMINATIM) }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await expect(page.getByLabel("Address · food gets delivered here")).toHaveValue("B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi, Delhi");
  await expect(page.getByLabel("Pin code")).toHaveValue("110016");
  await page.getByLabel("Address · food gets delivered here").fill("B-12, Lajpat Nagar II, near the park gate");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Hauz Khas Kitchen");   // the kitchen is back-end information
  await expect(page.getByText(/Open till/)).toBeVisible();
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByLabel("Address · food gets delivered here")).toHaveValue("B-12, Lajpat Nagar II, near the park gate");
});

test("S3 without location the customer types the address and pin; See the menu waits for both", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();   // not allowed in this context
  await expect(ask(page)).toBeVisible();
  await expect(page.getByText("We could not get your location. Type it by hand.")).toBeVisible();
  const go = page.getByRole("button", { name: "See the menu" });
  await expect(go).toBeDisabled();
  await page.getByLabel("Address · food gets delivered here").fill("Flat 4, Green Park");
  await expect(go).toBeDisabled();
  await page.getByLabel("Pin code").fill("110016");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S4 a place the lookup cannot read falls back to typing, with the words kept short", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (route) => route.fulfill({ status: 429, headers: { "access-control-allow-origin": "*" }, body: "slow down" }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("We could not get your location. Type it by hand.")).toBeVisible();
});

test("S5 a pin code no kitchen serves says so on the same screen", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Type it by hand" }).click();
  await page.getByLabel("Address · food gets delivered here").fill("Somewhere far");
  await page.getByLabel("Pin code").fill("110099");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Not here yet. We do not deliver to 110099 yet.")).toBeVisible();
});

test("S5 a pin that contradicts its own state is not filled in: the address shows the city and the state, and the customer types the pin (story 827)", async ({ page, context }) => {
  // OpenStreetMap holds a Gurgaon object tagged 110058 (a Delhi pin) beside state Haryana.
  const GURGAON = { address: { road: "Sector 13 Road", city: "Gurugram", state: "Haryana", postcode: "110058", country: "India" } };
  await setup(context, page, [], { pin: null });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.4595, longitude: 77.0266 });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(GURGAON) }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByRole("heading", { name: "Is this right?" })).toBeVisible();
  await expect(page.getByLabel("Address · food gets delivered here")).toHaveValue("Sector 13 Road, Gurugram, Haryana");
  await expect(page.getByLabel("Pin code")).toHaveValue("");
  await expect(page.getByRole("alert")).toHaveCount(0);   // an empty pin is asked for, not shown as an error
  await expect(page.getByRole("button", { name: "See the menu" })).toBeDisabled();
  await page.getByLabel("Pin code").fill("122004");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeEnabled();
});
