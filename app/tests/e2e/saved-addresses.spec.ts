// Story #976, board C2-AddressSheet: saved addresses, the pick on open by the phone's place, the Deliver to page with add, select, edit and remove.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const NOW = Date.now();
const row = (id: string, label: string, address: string, lat: number, lng: number, agoDays: number) => ({ id, label, address, pin_code: "110016", lat, lng, last_used_at: new Date(NOW - agoDays * 86_400_000).toISOString() });
const HOME = row("h1", "Home", "C-4, Green Park Extension, New Delhi", 28.5677, 77.2432, 3);
const OFFICE = row("o1", "Office", "Tower B, Connaught Place, New Delhi", 28.6315, 77.2167, 1);   // more recently used, about 8 km from Home

async function open(page: Page, context: Parameters<typeof setup>[0], at: { latitude: number; longitude: number } | null, list = [HOME, OFFICE], tune?: (s: any) => void) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = list;
  tune?.(net.state);
  if (at) { await context.grantPermissions(["geolocation"]); await context.setGeolocation(at); }
  await page.goto("/customer/");
  return net;
}
const AT_HOME = { latitude: 28.5678, longitude: 77.2433 };
const dialog = (page: Page) => page.getByRole("heading", { name: "Deliver to", exact: true });

test("S1 story #1035: phone at Home, the one used last (Office) is still picked on open; Home shows here, Office 8 km", async ({ page, context }) => {
  await open(page, context, AT_HOME);
  await expect(page.getByRole("button", { name: /^Office\b/ })).toContainText("Connaught Place");
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^Office\b/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByText("2 saved")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Office" })).toContainText("Selected");
  await expect(page.getByRole("listitem").filter({ hasText: "Home" })).toContainText("here");
  await expect(page.getByRole("listitem").filter({ hasText: "Office" })).toContainText("8 km");
});

test("S2 story #1035: phone far from every saved address, the page does not open by itself, the last used one is picked, and the radius is never read", async ({ page, context }) => {
  let reads = 0;
  await context.route("**/rest/v1/rpc/address_near_m", (r) => { reads++; return r.abort(); });
  await open(page, context, { latitude: 28.5, longitude: 77.3 });
  await expect(page.getByRole("button", { name: /^Office\b/ })).toContainText("Connaught Place");
  await expect(dialog(page)).toHaveCount(0);
  expect(reads).toBe(0);
  await page.getByRole("button", { name: /^Office\b/ }).click();
  await expect(page.locator(".ui-deliver-foot")).toHaveCount(0);   // owner rule 8 Nov: the page ends with the list, no line about why
});

test("S3 no location permission: the last used address stays picked and the page does not open by itself", async ({ page, context }) => {
  await open(page, context, null);
  await expect(page.getByRole("button", { name: /^Office\b/ })).toContainText("Connaught Place");
  await expect(dialog(page)).toHaveCount(0);
});

test("S4 Add new address with a label saves a row, shows it with its distance, and the Bill uses it", async ({ page, context }) => {
  const net = await open(page, context, AT_HOME, [HOME, OFFICE], (st) => { st.geocode = { status: 200, body: { ok: true, address: "Hauz Khas Village, New Delhi, Delhi", pin: "110016", locality: "Hauz Khas", town: "New Delhi" } }; });
  await page.getByRole("button", { name: /^Office\b/ }).click();   // story #1035: the last used one is on top
  await page.getByRole("button", { name: "Add new address" }).click();
  await page.getByRole("button", { name: "Confirm & proceed" }).click();   // story #1037: the map is the door
  const sheet = page.getByRole("dialog", { name: "Address details" });   // story #1038: then the details
  await sheet.getByLabel("House, street, colony, ward").fill("House 9");
  await sheet.getByRole("button", { name: "Other", exact: true }).click();
  await sheet.getByLabel("Name this place").fill("Nani's house");
  await sheet.getByRole("button", { name: "Save address" }).click();
  await expect.poll(() => net.state.addresses.length).toBe(3);
  expect(net.state.addresses.at(-1)).toMatchObject({ label: "Nani's house", pin_code: "110016" });
  await expect(page.getByRole("button", { name: /^Nani's house\b/ })).toBeVisible();
});

test("S5 Remove the selected address: after the Undo bar runs out the next most recent is Selected; with none left the first-visit screen shows", async ({ page, context }) => {
  await page.clock.install({ time: new Date(NOW) });
  await open(page, context, AT_HOME);
  await page.getByRole("button", { name: /^Office\b/ }).click();
  await page.getByRole("button", { name: "Edit or remove Office" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.clock.runFor(6_500);   // story #1051: the delete waits for Undo
  await expect(page.getByRole("listitem").filter({ hasText: "Home" })).toContainText("Selected");
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.clock.runFor(6_500);
  await expect(page.getByRole("button", { name: "Set delivery location" })).toBeVisible();
});

test("S6 Edit opens the filled details (story 1421, ED1); the label changes and the row is updated", async ({ page, context }) => {
  const net = await open(page, context, AT_HOME, [HOME, OFFICE], (st) => { st.geocode = { status: 200, body: { ok: true, address: "Connaught Place, New Delhi", pin: "110016", locality: "Connaught Place", town: "New Delhi" } }; });
  await page.getByRole("button", { name: /^Office\b/ }).click();
  await page.getByRole("button", { name: "Edit or remove Office" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Address details" });
  await sheet.getByRole("button", { name: "Other", exact: true }).click();
  await sheet.getByLabel("Name this place").fill("Work");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => net.state.addresses.find((r: any) => r.id === "o1")?.label).toBe("Work");
});

test("S7 today's single saved address becomes the first row labelled Home, once", async ({ page, context }) => {
  const net = await open(page, context, null, [], (s) => { s.customer = { user_id: "u", name: "Asha", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" }; });
  await expect.poll(() => net.state.addresses.length).toBe(1);
  expect(net.state.addresses[0]).toMatchObject({ label: "Home", address: "Flat 4, Green Park", pin_code: "110016" });
  await page.reload();
  await expect(page.getByRole("button", { name: /^Home\b/ })).toBeVisible();
  expect(net.state.addresses).toHaveLength(1);
});

test("S8 the search box on the Deliver to page is 48 px high, not stretched down the column", async ({ page, context }) => {
  await open(page, context, AT_HOME);
  await page.getByRole("button", { name: /^(Office|Deliver to)\b/ }).click();
  const box = (await page.locator(".ui-deliver-to .ui-search-box").boundingBox())!;
  expect(Math.round(box.height)).toBe(48);
  const cards = (await page.locator(".ui-two-cards").boundingBox())!;
  expect(cards.y - (box.y + box.height)).toBeLessThanOrEqual(24);   // the cards sit right under it
});
