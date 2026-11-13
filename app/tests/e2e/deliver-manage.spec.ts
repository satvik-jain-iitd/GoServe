// Story #1051 (boards C9 to C13, C6b): Deliver to. Edit opens the same map screen, Remove leaves an Undo bar for 6 seconds, an empty list says so, more than three rows hide behind View all.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const NOW = Date.now();
const row = (id: string, label: string, address: string, lat: number, lng: number, agoDays: number) => ({ id, label, address, pin_code: "110016", lat, lng, last_used_at: new Date(NOW - agoDays * 86_400_000).toISOString() });
const HOME = row("h1", "Home", "C-128, near the park gate, Green Park, New Delhi", 28.5677, 77.2432, 3);
const OFFICE = row("o1", "Office", "Tower B, Connaught Place, New Delhi", 28.6315, 77.2167, 1);
const MORE = [row("a1", "Bhopal home", "Flat 41, Chitragupt Nagar, Bhopal", 23.2, 77.4, 4), row("a2", "Work", "171/7, Hans Enclave, Gurugram", 28.4, 77.0, 5), row("a3", "Shubhi", "Room 407, Patrika Nagar, Hyderabad", 17.4, 78.4, 6)];
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };

async function open(page: Page, context: Parameters<typeof setup>[0], list: object[]) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = list;
  net.state.geocode = { status: 200, body: GREEN_PARK };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Office|Home|Deliver to)\b/ }).first().click();
  await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
  return net;
}

test("S1 (C9, story 1421 ED1 and ED2) Edit opens the filled details; Change shows the map at the saved pin; Save updates the same row", async ({ page, context }) => {
  const net = await open(page, context, [HOME, OFFICE]);
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit address" });
  await expect(sheet.getByLabel("House, street, colony, ward")).toHaveValue("C-128, near the park gate, Green Park, New Delhi");   // an older row: all of its text, nothing lost
  await expect(sheet.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByLabel("House, street, colony, ward").fill("C-129, near the park gate");
  await sheet.getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByText("Editing Home")).toBeVisible();
  expect(await page.locator(".ui-pinmap-credit a").first().evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe("none");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet.getByLabel("House, street, colony, ward")).toHaveValue("C-129, near the park gate");   // kept across Change and back
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => net.state.addresses.find((r: any) => r.id === "h1")?.address).toBe("C-129, near the park gate, Green Park, New Delhi, Delhi");
  expect(net.state.addresses.find((r: any) => r.id === "h1").house).toBe("C-129, near the park gate");
  expect(net.state.addresses).toHaveLength(2);
  expect(net.state.addresses.find((r: any) => r.id === "h1").lat).not.toBeNull();
});

test("S2 (C10) Remove: the row leaves at once, the Undo bar counts 6 sec, Undo puts it back in place and nothing is deleted", async ({ page, context }) => {
  await page.clock.install({ time: new Date(NOW) });
  const net = await open(page, context, [HOME, OFFICE]);
  await page.getByRole("button", { name: "Edit or remove Office" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Office" })).toHaveCount(0);
  await expect(page.getByText("1 saved")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Home" })).toContainText("Selected");   // board C10: the row that takes over
  const bar = page.getByRole("status").filter({ hasText: "Office removed" });
  await expect(bar).toContainText("6 sec");
  await page.clock.runFor(2_000);
  await expect(bar).toContainText("4 sec");
  await bar.getByRole("button", { name: "Undo" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("listitem").nth(0)).toContainText("Office");   // the same place: it was used last, so it is on top again
  await page.clock.runFor(10_000);
  expect(net.state.addresses.map((r: any) => r.id).sort()).toEqual(["h1", "o1"]);
});

test("S3 (C10) Remove without Undo: after 6 seconds the row is deleted", async ({ page, context }) => {
  await page.clock.install({ time: new Date(NOW) });
  const net = await open(page, context, [HOME, OFFICE]);
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  expect(net.state.addresses).toHaveLength(2);   // still there until the bar runs out
  await page.clock.runFor(6_500);
  await expect.poll(() => net.state.addresses.map((r: any) => r.id)).toEqual(["o1"]);
  await expect(page.getByRole("status").filter({ hasText: "Home removed" })).toHaveCount(0);
});

test("S4 (C11) no saved address: the empty line shows, 0 saved, both doors stay", async ({ page, context }) => {
  await open(page, context, []);
  await expect(page.getByText("0 saved")).toBeVisible();
  await expect(page.getByText("No saved address yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add new address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use current location" })).toBeVisible();
  await expect(page.getByText("Saved addresses")).toHaveCount(0);
});

test("S5 (C12, C13) five saved: three rows and View all; View all shows all five and goes away", async ({ page, context }) => {
  await open(page, context, [HOME, OFFICE, ...MORE]);
  await expect(page.getByText("5 saved")).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "View all" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "View all" })).toHaveCount(0);
});

test("S6 three saved: no View all", async ({ page, context }) => {
  await open(page, context, [HOME, OFFICE, MORE[0]]);
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "View all" })).toHaveCount(0);
});
