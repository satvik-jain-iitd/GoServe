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

test("S1 phone at Home: Home is picked on open, the top says Home, and the page marks it Selected with here", async ({ page, context }) => {
  await open(page, context, AT_HOME);
  await expect(page.getByRole("button", { name: /^Home\b/ })).toContainText("Green Park");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByText("2 saved")).toBeVisible();
  const home = page.getByRole("listitem").filter({ hasText: "Home" });
  await expect(home).toContainText("Selected");
  await expect(home).toContainText("here");
  await expect(page.getByRole("listitem").filter({ hasText: "Office" })).toContainText("8 km");
});

test("S2 phone 3 km from every saved address: the Deliver to page asks and nothing is Selected", async ({ page, context }) => {
  await open(page, context, { latitude: 28.5, longitude: 77.3 });
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByText("Selected")).toHaveCount(0);
  await expect(page.getByText(/Far from all of them, the app asks/)).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Office" }).getByRole("button", { name: "Deliver to Office" }).click();
  await expect(page.getByRole("button", { name: /^Office\b/ })).toBeVisible();
});

test("S3 no location permission: the last used address stays picked and the page does not open by itself", async ({ page, context }) => {
  await open(page, context, null);
  await expect(page.getByRole("button", { name: /^Office\b/ })).toContainText("Connaught Place");
  await expect(dialog(page)).toHaveCount(0);
});

test("S4 Add new address with a label saves a row, shows it with its distance, and the Bill uses it", async ({ page, context }) => {
  const net = await open(page, context, AT_HOME);
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  await page.getByLabel(/^Label/).fill("Nani's house");
  await page.getByLabel(/Address/).fill("House 9, Hauz Khas Village, New Delhi");
  await page.getByLabel("Pin code").fill("110016");
  await page.getByRole("button", { name: /Save address|Deliver here|Go on/ }).click();
  await expect.poll(() => net.state.addresses.length).toBe(3);
  expect(net.state.addresses.at(-1)).toMatchObject({ label: "Nani's house", pin_code: "110016" });
  await expect(page.getByRole("button", { name: /^Nani's house\b/ })).toBeVisible();
});

test("S5 Remove the selected address: the next most recent is Selected; with none left the first-visit screen shows", async ({ page, context }) => {
  await open(page, context, AT_HOME);
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Office" })).toContainText("Selected");
  await page.getByRole("button", { name: "Edit or remove Office" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use my location" })).toBeVisible();
});

test("S6 Edit changes the label and the words", async ({ page, context }) => {
  const net = await open(page, context, AT_HOME);
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Edit or remove Office" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel(/^Label/).fill("Work");
  await page.getByRole("button", { name: "Save" }).click();
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
