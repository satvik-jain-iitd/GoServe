// Story #1128 (board C6b, owner yes 9 Nov): a pin outside every kitchen area. Confirm & proceed goes straight to NK-A (We don't reach here yet) and C7 never opens.
// The serve check still loading: Confirm waits (no NK-A flash on a served pin). Offline or no answer: the old way on to C7.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const FAR = { status: 200, body: { ok: true, serviceable: false, request_here: true, kitchens: [] } };

async function toMap(page: Page, context: Parameters<typeof setup>[0], serve: { status: number; body: object } | null) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: GREEN_PARK };
  if (serve) net.state.serve = serve;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 28.56, longitude: 77.2 });
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  return net;
}

test("S1 a pin outside every area: the button reads Invite the founders here; one tap saves the ask and opens the founder note, never C7 or NK-A", async ({ page, context }) => {
  const net = await toMap(page, context, FAR);
  await expect(page.getByText("Not in our area yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);
  await page.getByRole("button", { name: "Invite the founders here" }).click();
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
  await expect(page.getByRole("group", { name: "A letter from co-founder Satvik Jain" })).toContainText("Green Park");
  const asks = net.calls.rpc.filter((c) => c.name === "area_request_add_v2");
  expect(asks).toHaveLength(1);
  expect(asks[0].body).toMatchObject({ p_pin: "110016" });
  await expect(page.getByRole("dialog", { name: "Address details" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "We don't reach here yet" })).toHaveCount(0);
});

test("S2 Change location on the letter returns to the map", async ({ page, context }) => {
  await toMap(page, context, FAR);
  await page.getByRole("button", { name: "Invite the founders here" }).click();
  await page.getByRole("button", { name: "Change location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
});

test("S2b when the ask cannot be saved the words say so on the map and the button stays", async ({ page, context }) => {
  const net = await toMap(page, context, FAR);
  net.state.areaRequest = { ok: false, message: "That pin code is not valid." };
  await page.getByRole("button", { name: "Invite the founders here" }).click();
  await expect(page.getByRole("alert")).toContainText("That pin code is not valid.");
  await expect(page.getByRole("button", { name: "Invite the founders here" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toHaveCount(0);
});

test("S3 a served pin keeps Confirm & proceed and goes on to C7", async ({ page, context }) => {
  await toMap(page, context, null);
  await expect(page.getByText(/We deliver here/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "We don't reach here yet" })).toHaveCount(0);
});

test("S4 while the serve check is still loading Confirm waits, and never flashes NK-A for a served pin", async ({ page, context }) => {
  await toMap(page, context, null);
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
  await context.route("https://test.supabase.co/functions/v1/serviceability**", () => new Promise(() => undefined));   // no answer for the next ask
  await context.setGeolocation({ latitude: 28.575, longitude: 77.25 });   // story 1393: the phone is somewhere else, so the pin moves and a new ask goes out
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeDisabled();
});

// Story 1426 (board PE1, owner "Haan A"): a place with no serve answer is never confirmed. This replaces the old S5 (offline went on to C7).
const CHECK = "We could not check this place. Check your internet.";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json" };
const SERVED = { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-1", name: "Green Park Kitchen", distance_m: 1230, eta_min: 30, open: true }] };
async function drag(page: Page) {
  const map = (await page.getByRole("application", { name: "Map" }).boundingBox())!;
  await page.mouse.move(map.x + map.width / 2, map.y + 200);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width / 2 + 120, map.y + 260, { steps: 8 });
  await page.mouse.up();
}
async function failedState(page: Page) {
  await expect(page.getByText(CHECK)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^We deliver here/)).toHaveCount(0);
  await expect(page.getByText("Not in our area yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
}

test("S5 no serve answer at all (offline): the yellow could-not-check line and Try again, never Confirm", async ({ page, context }) => {
  await toMap(page, context, { status: 503, body: { ok: false } });
  await failedState(page);
  await expect(page.getByText(CHECK)).toHaveAttribute("role", "status");
});

test("S6 a served place, then the serve check fails at a new place: the old green line goes, the yellow line and Try again come", async ({ page, context }) => {
  await toMap(page, context, null);
  await expect(page.getByText(/^We deliver here/)).toBeVisible();
  const card0 = (await page.locator(".ui-pinmap-card").boundingBox())!.height;
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 500, headers: CORS, body: "{}" }));
  await drag(page);
  await failedState(page);
  expect((await page.locator(".ui-pinmap-card").boundingBox())!.height).toBe(card0);   // the card keeps its height
});

test("S7 the network comes back: Try again asks again and brings the true line and Confirm", async ({ page, context }) => {
  await toMap(page, context, null);
  await expect(page.getByText(/^We deliver here/)).toBeVisible();
  let down = true, asks = 0;
  await context.route("https://test.supabase.co/functions/v1/serviceability**", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    asks++;
    if (!down) await new Promise((ok) => setTimeout(ok, 300));
    return down ? r.fulfill({ status: 500, headers: CORS, body: "{}" }) : r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(SERVED) });
  });
  await drag(page);
  await failedState(page);
  down = false;
  const before = asks;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeDisabled();   // busy: no second tap
  await expect(page.getByText(/^We deliver here/)).toBeVisible();
  expect(asks).toBeGreaterThan(before);
  await expect(page.getByText(CHECK)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
});

test("S8 the serve check never answers: after the wait limit, the same could-not-check state", async ({ page, context }) => {
  test.setTimeout(45_000);
  await toMap(page, context, null);
  await expect(page.getByText(/^We deliver here/)).toBeVisible();
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : undefined);   // never answers
  await drag(page);
  await failedState(page);
});

// Story 1462 (reviewer's call, rule 20): the pin moved and the new place's name did not come: the card never keeps the old place's name.
test("S9 both lookups fail at a new place: the old name goes and the card says Pin on the map; Try again brings the new name", async ({ page, context }) => {
  const net = await toMap(page, context, null);
  const card = page.locator(".ui-pinmap-card");
  await expect(card.locator(".ui-pinmap-name")).toHaveText("Green Park");
  let down = true;
  await context.route("https://test.supabase.co/functions/v1/serviceability**", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : down ? r.fulfill({ status: 500, headers: CORS, body: "{}" }) : r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(SERVED) }));
  net.state.geocode = { status: 500, body: {} };
  await drag(page);
  await failedState(page);
  await expect(card.locator(".ui-pinmap-name")).toHaveText("Pin on the map");
  await expect(card.getByText("Green Park")).toHaveCount(0);
  await expect(card.getByText("New Delhi, Delhi")).toHaveCount(0);   // the old address line is gone; only the quiet "Could not read the address" note stays
  await expect(card.locator(".ui-pinmap-addr")).toHaveText("Could not read the address, the pin still counts");
  down = false;
  net.state.geocode = { status: 200, body: { ok: true, address: "Hauz Khas, New Delhi, Delhi", pin: "110016", locality: "Hauz Khas", town: "New Delhi" } };
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(card.locator(".ui-pinmap-name")).toHaveText("Hauz Khas");
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
});
