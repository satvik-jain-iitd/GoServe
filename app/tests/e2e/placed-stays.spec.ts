// Story #1014: after Place order succeeds the customer sees the placed screen and nothing but their own tap moves them off it, even while the live list reloads without the new order for a moment.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const NEW = { ...order("placed", new Date(Date.now() + 1000).toISOString()), id: "0f0f0f0f-aaaa-4bbb-8ccc-dddddddddddd", total_paise: 32000 };
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };

async function placeOne(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}
const wake = (page: Page) => page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });

test("S1 the placed screen stays while the live list answers with the order, then without it, then with it again", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.addresses = [HOME];
  net.state.reply = { status: 201, body: { ok: true, created: true, order: NEW } };
  await page.goto("/customer/");
  await placeOne(page);
  net.state.orders = [NEW]; await wake(page); await page.waitForTimeout(600);
  net.state.orders = []; await wake(page); await page.waitForTimeout(600);
  net.state.orders = [NEW]; await wake(page); await page.waitForTimeout(600);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await page.getByRole("button", { name: "Back to menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S2 a slow phone location that answers after the order is placed does not pull the customer off the placed screen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.addresses = [HOME];   // far from the phone below, so the pick would open the Deliver to page
  net.state.reply = { status: 201, body: { ok: true, created: true, order: NEW } };
  await context.grantPermissions(["geolocation"]);
  await page.addInitScript(() => {
    const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (ok, err, opts) => { setTimeout(() => real(ok, err, opts), 4000); };   // a phone that takes its time to find itself
  });
  await context.setGeolocation({ latitude: 28.5, longitude: 77.3 });
  await page.goto("/customer/");
  await placeOne(page);
  await page.waitForTimeout(6000);
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toHaveCount(0);
});

test("S3 a slow phone location that answers while the customer is on the Bill leaves the Bill and the typed address alone", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.addresses = [HOME];
  await context.grantPermissions(["geolocation"]);
  await page.addInitScript(() => {
    const real = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (ok, err, opts) => { setTimeout(() => real(ok, err, opts), 3000); };
  });
  await context.setGeolocation({ latitude: 28.5678, longitude: 77.2433 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("My own typed address, Chhatarpur");
  await page.waitForTimeout(5000);
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByLabel("Address")).toHaveValue("My own typed address, Chhatarpur");
});
