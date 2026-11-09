// Story #1011: an empty pin box shows 123456 in the muted placeholder colour on every pin box, so nobody reads a real-looking pin as a filled value. The value stays empty; Continue stays off until six real digits.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const muted = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector<HTMLInputElement>(s)!;
  return { hint: getComputedStyle(el, "::placeholder").color, text: getComputedStyle(el).color };
}, sel);

test("S2 the address details on the map show the grey 123456 hint when the map gave no pin code", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [{ id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: null, lng: null, last_used_at: new Date().toISOString() }];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi", pin: null, locality: "Green Park", town: "New Delhi" } };   // story #1051: the old edit sheet is gone; Edit opens the map and its details
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByLabel("Pin code")).toHaveAttribute("placeholder", "123456");
});

test("S3 the admin pin code boxes (Add kitchen, Edit kitchen) show 123456 too", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "+ Add a kitchen" }).click();
  await expect(page.getByLabel("Pin codes")).toHaveAttribute("placeholder", /^123456/);
  await page.getByRole("button", { name: "Back to city" }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel(/^Pin codes/).fill("");
  await expect(page.getByLabel(/^Pin codes/)).toHaveAttribute("placeholder", /^123456/);
});
