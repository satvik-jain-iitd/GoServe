// Story #1011: an empty pin box shows 123456 in the muted placeholder colour on every pin box, so nobody reads a real-looking pin as a filled value. The value stays empty; Continue stays off until six real digits.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const muted = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector<HTMLInputElement>(s)!;
  return { hint: getComputedStyle(el, "::placeholder").color, text: getComputedStyle(el).color };
}, sel);

test("S1 the address step by hand: 123456 in grey, empty value, Continue off until six digits", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Type it by hand" }).click();
  const pin = page.getByLabel("Pin code");
  await expect(pin).toHaveAttribute("placeholder", "123456");   // story #1044: the by-hand step shows 123456
  await expect(pin).toHaveValue("");
  const c = await muted(page, "#pin");
  expect(c.hint).not.toBe(c.text);
  await page.getByLabel(/Address/).fill("Flat 4, Green Park");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeDisabled();
  await pin.fill("1100");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeDisabled();
  await pin.fill("110016");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeEnabled();
});

test("S2 the saved address edit sheet shows the grey 123456 hint", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [{ id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: null, lng: null, last_used_at: new Date().toISOString() }];
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();   // story #1037, #1038: Add new address is the map now; the pin box with its hint is on the edit sheet below
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Pin code").fill("");
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
