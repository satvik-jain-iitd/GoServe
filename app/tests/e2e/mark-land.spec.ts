// Story #525: the pin mark in the Menu header flies in once, right after the pin screen. Switching tabs back to the Menu never replays it.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";
import { firstOpenToMenu } from "./firstOpen";

const mark = (page: import("@playwright/test").Page) => page.locator(".ui-pin-svg");

test("S1 right after the pin screen the mark flies once into the header", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ address: { road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } }) }));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await page.goto("/customer/");
  await firstOpenToMenu(page);
  await expect(mark(page)).toHaveClass(/ui-mark-land/);
});

test("S2 coming back to the Menu from History or the profile, the mark is already in place and nothing moves", async ({ page, context }) => {
  await setup(context, page, [], { pin: "110016" });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).not.toHaveClass(/ui-mark-land/);   // a saved pin is not a fresh pick
  for (const [open, back] of [["History", "Delivery"], ["You: your details, alerts and account", "Close"]]) {
    await page.getByRole("button", { name: open }).click();
    await page.getByRole("button", { name: back, exact: true }).click();
    await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
    await expect(mark(page)).not.toHaveClass(/ui-mark-land/);
  }
});

test("S2 after the first fly-in a tab switch does not replay it", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.route("https://nominatim.openstreetmap.org/reverse**", (r) => r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ address: { road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110016", country: "India" } }) }));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5677, longitude: 77.2432 });
  await page.goto("/customer/");
  await firstOpenToMenu(page);
  await expect(mark(page)).toHaveClass(/ui-mark-land/);
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(mark(page)).not.toHaveClass(/ui-mark-land/);
});
