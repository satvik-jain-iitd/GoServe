// Story #1102 follow-up (found by the live spec, 9 Nov): the pin map's served strip must not wait for the address lookup. A slow or hanging lookup (Ola, then OpenStreetMap)
// left the card with no strip and no way on. The strip is asked at once with the place; when the lookup brings a pin it is asked again with that pin, and the last answer shows.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };

async function open(page: import("@playwright/test").Page, context: Parameters<typeof setup>[0], hang: boolean, after?: () => Promise<void>) {
  const net = await setup(context, page, [], { pin: "110016" });
  await after?.();   // routes added here win over the ones setup made
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

test("a slow place-only answer cannot overwrite the pin answer", async ({ page, context }) => {
  // the place alone says "served" late (1.5 s); the pin answer says "not served" at once. The pin answer is the better one and must stay.
  const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
  const slow = async () => {
    await context.route("https://test.supabase.co/functions/v1/serviceability**", async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const withPin = req.url().includes("pin=");
      if (!withPin) await new Promise((r) => setTimeout(r, 1_500));
      const body = withPin ? { ok: true, serviceable: false, request_here: true, kitchens: [] } : { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-1", name: "Hauz Khas Kitchen", distance_m: 1230, eta_min: 30, open: true }] };
      return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
    });
  };
  await open(page, context, false, slow);
  await expect(page.getByText("Not in our area yet")).toBeVisible();
  await page.waitForTimeout(2_500);   // the slow place-only answer has landed by now
  await expect(page.getByText("Not in our area yet")).toBeVisible();
  await expect(page.getByText(/We deliver here/)).toHaveCount(0);
});

test("C7 the details sheet is tall enough for its content: no inner scroll, the title fully in view (360 x 740, story 1124)", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, context, false);
  await expect(page.getByText(/We deliver here/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  const sheet = page.getByRole("dialog", { name: "Address details" });
  await expect(sheet).toBeVisible();
  const m = await sheet.evaluate((e) => ({ scroll: e.scrollHeight, client: e.clientHeight, top: e.getBoundingClientRect().top, title: e.querySelector("h2")!.getBoundingClientRect().top }));
  expect(m.scroll).toBeLessThanOrEqual(m.client);   // no scroll inside the sheet
  expect(m.title).toBeGreaterThanOrEqual(0);        // the title is inside the screen
  expect(m.title).toBeGreaterThanOrEqual(m.top);    // and inside its own sheet
});
