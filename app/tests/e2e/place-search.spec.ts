// Story #1036, board C8-SearchResults: typing filters the saved list only; on submit (the arrow or Enter) a Places section from our own table appears, served first, five at most.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const NOW = Date.now();
const row = (id: string, label: string, address: string, agoDays: number) => ({ id, label, address, pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(NOW - agoDays * 86_400_000).toISOString() });
const HOME = row("h1", "Home", "C-4, Green Park Extension, New Delhi", 3);
const OFFICE = row("o1", "Office", "Tower B, Connaught Place, New Delhi", 1);
const PLACES = { status: 200, body: { ok: true, results: [
  { name: "Green Park", address: "Green Park, Delhi, 110016", lat: 28.5599, lng: 77.2065, pin: "110016", served: true },
  { name: "Green Park Extension", address: "Green Park Extension, Delhi, 110049", lat: 28.5575, lng: 77.206, pin: "110049", served: false },
] } };

async function open(page: Page, context: Parameters<typeof setup>[0], places = PLACES as null | { status: number; body: object }) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME, OFFICE];
  net.state.places = places;
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Office\b/ }).click();
  return net;
}
const box = (page: Page) => page.getByRole("searchbox", { name: "Search an area or address" });

test("S1 typing filters the saved rows and makes no place call", async ({ page, context }) => {
  const net = await open(page, context);
  await box(page).fill("green park");
  await expect(page.getByRole("listitem").filter({ hasText: "Home" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Office" })).toHaveCount(0);
  await expect(page.getByText("Saved · 1 match")).toBeVisible();
  await expect(page.getByText(/Places ·/)).toHaveCount(0);
  await page.waitForTimeout(900);   // longer than any debounce: still nothing asked
  expect(net.calls.places).toHaveLength(0);
});

test("S2 Enter asks once and shows Places with the served tag first and Not yet after", async ({ page, context }) => {
  const net = await open(page, context);
  await box(page).fill("green park");
  await box(page).press("Enter");
  await expect(page.getByText("Places · 2 found")).toBeVisible();
  expect(net.calls.places).toHaveLength(1);
  expect(net.calls.places[0]).toContain("q=green%20park");
  const places = page.getByRole("region", { name: "Places" }).getByRole("button");
  await expect(places.nth(0)).toContainText("Green Park");
  await expect(places.nth(0)).toContainText("We deliver here");
  await expect(places.nth(1)).toContainText("Not yet");
  await expect(page.locator(".ui-deliver-foot")).toHaveCount(0);   // owner rule 8 Nov: no explanation line under the list
});

test("S3 the round arrow in the box submits too", async ({ page, context }) => {
  const net = await open(page, context);
  await box(page).fill("green park");
  await page.getByRole("button", { name: "Search places" }).click();
  await expect(page.getByText("Places · 2 found")).toBeVisible();
  expect(net.calls.places).toHaveLength(1);
});

test("S4 a word shorter than three letters does not ask", async ({ page, context }) => {
  const net = await open(page, context);
  await box(page).fill("gr");
  await box(page).press("Enter");
  await expect(page.getByText("Type at least 3 letters to search places.")).toBeVisible();
  expect(net.calls.places).toHaveLength(0);
});

test("S5 nothing found says so in words", async ({ page, context }) => {
  await open(page, context, { status: 200, body: { ok: true, results: [] } });
  await box(page).fill("zzzzzz");
  await box(page).press("Enter");
  await expect(page.getByText("No place found. Try the start of a colony name or a pin code.")).toBeVisible();
});

test("S5b a failed search says it could not search", async ({ page, context }) => {
  await open(page, context, { status: 502, body: { ok: false, error: "search_unavailable" } });
  await box(page).fill("green park");
  await box(page).press("Enter");
  await expect(page.getByRole("alert")).toContainText("Could not search places. Try again.");
});

test("S6 tapping a place hands its words to the add flow", async ({ page, context }) => {
  await open(page, context);
  await box(page).fill("green park");
  await box(page).press("Enter");
  await page.getByRole("region", { name: "Places" }).getByRole("button").first().click();
  await expect(page.getByLabel(/Address/)).toHaveValue("Green Park, Delhi, 110016");
});

test("S7 changing the words clears the places of the last search", async ({ page, context }) => {
  await open(page, context);
  await box(page).fill("green park");
  await box(page).press("Enter");
  await expect(page.getByText("Places · 2 found")).toBeVisible();
  await box(page).fill("green parks");
  await expect(page.getByText(/Places ·/)).toHaveCount(0);
});
