// Story #1102 follow-up (found by the live spec, 9 Nov): the pin map's served strip must not wait for the address lookup. A slow or hanging lookup (Ola, then OpenStreetMap)
// left the card with no strip and no way on. The strip is asked at once with the place; when the lookup brings a pin it is asked again with that pin, and the last answer shows.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };

async function open(page: import("@playwright/test").Page, context: Parameters<typeof setup>[0], hang: boolean) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: GREEN_PARK };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  if (hang) await context.route("https://test.supabase.co/functions/v1/geocode**", () => new Promise(() => undefined));   // the lookup never answers
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 28.56, longitude: 77.2 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  return net;
}

test("a hanging address lookup does not hide the served strip", async ({ page, context }) => {
  await open(page, context, true);
  await expect(page.getByText(/We deliver here/)).toBeVisible({ timeout: 6_000 });
});

test("when the lookup brings a pin, the strip is asked again with it", async ({ page, context }) => {
  const net = await open(page, context, false);
  await expect(page.getByText(/We deliver here/)).toBeVisible();
  await expect.poll(() => net.calls.serve.some((u: string) => u.includes("pin=110016"))).toBe(true);
  expect(net.calls.serve.some((u: string) => !u.includes("pin="))).toBe(true);   // and once at once, with the place alone
});
