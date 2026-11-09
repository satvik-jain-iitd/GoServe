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
  await page.getByRole("button", { name: "Current Location" }).click();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeDisabled();
});

test("S5 no serve answer at all (offline) goes on to C7 the old way, not NK-A", async ({ page, context }) => {
  await toMap(page, context, { status: 503, body: { ok: false } });
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
});
