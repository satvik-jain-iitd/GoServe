// Story #1519: the search shows places from Ola Maps near the map, as you type. The server (place-search) is a stand-in here; no test holds a real Ola answer.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const HOME = { id: "h1", label: "Home", address: "C-4, Model Town, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const PHONE = { latitude: 28.56, longitude: 77.2 };
const hit = (name: string, from: "ola" | "own", over: object = {}) => ({ name, address: "Sample Area, Sample City", lat: 28.61, lng: 77.23, pin: "", served: true, from, ...over });
const answer = (from: "ola" | "own", results: object[]) => ({ status: 200, body: { ok: true, from, results } });
const OLA = answer("ola", [hit("Sample Chowk", "ola"), hit("Sample Chowk", "ola", { address: "Other Area, Sample City", lat: 28.62, served: false })]);   // two rows may share a name
const OWN = answer("own", [hit("Sample Nagar", "own", { pin: "110016", address: "Sample Nagar, Delhi, 110016" })]);

async function deliverTo(page: Page, context: Parameters<typeof setup>[0], places: object) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  net.state.places = places as typeof net.state.places;
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation(PHONE);
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  return net;
}
async function onMap(page: Page, context: Parameters<typeof setup>[0], places: object = OLA) {
  const net = await deliverTo(page, context, places);
  await page.getByRole("button", { name: "Add new address" }).click();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
  await page.getByRole("button", { name: "Search an area or address" }).click();
  return net;
}
const box = (page: Page) => page.getByRole("searchbox", { name: "Search an area or address" });
const places = (page: Page) => page.getByRole("region", { name: "Places" });
const asked = (url: string) => { const u = new URL(url).searchParams; return { q: u.get("q"), lat: Number(u.get("lat")), lng: Number(u.get("lng")) }; };

test("Suggestions while typing: 3 letters and a pause show places without Enter, and the ask carries the words and the map's place", async ({ page, context }) => {
  const net = await onMap(page, context);
  await box(page).pressSequentially("sam");
  await expect(places(page).getByRole("button")).toHaveCount(2);
  await expect(places(page).getByRole("button").nth(0)).toContainText("Sample Chowk");
  await expect(places(page).getByRole("button").nth(0)).toContainText("Sample Area, Sample City");   // the area and city line under the name
  await expect(places(page).getByRole("button").nth(1)).toContainText("Not yet");
  expect(net.calls.places).toHaveLength(1);
  const a = asked(net.calls.places[0]);
  expect(a.q).toBe("sam");
  expect(a.lat).toBeCloseTo(PHONE.latitude, 2);
  expect(a.lng).toBeCloseTo(PHONE.longitude, 2);
});

test("Suggestions while typing: 2 letters ask nothing", async ({ page, context }) => {
  const net = await onMap(page, context);
  await box(page).pressSequentially("sa");
  await page.waitForTimeout(900);   // longer than the pause
  expect(net.calls.places).toHaveLength(0);
  await expect(places(page)).toHaveCount(0);
});

test("Suggestions while typing: an 8-letter word typed fast asks once, for the whole word", async ({ page, context }) => {
  const net = await onMap(page, context);
  await box(page).pressSequentially("samplech", { delay: 40 });
  await expect(places(page).getByRole("button")).toHaveCount(2);
  await page.waitForTimeout(900);
  expect(net.calls.places.map((u) => asked(u).q)).toEqual(["samplech"]);
});

test("Suggestions while typing: Enter asks at once and the pause does not ask again", async ({ page, context }) => {
  const net = await onMap(page, context);
  await box(page).fill("sample");
  await box(page).press("Enter");
  await expect(places(page).getByRole("button")).toHaveCount(2);
  await page.waitForTimeout(900);
  expect(net.calls.places).toHaveLength(1);
});

test("A pick moves the pin to the place: the map goes to the row's own point and no address is read", async ({ page, context }) => {
  const net = await onMap(page, context);
  await box(page).pressSequentially("sam");
  await places(page).getByRole("button").nth(1).click();
  await expect.poll(() => net.calls.serve.at(-1) ?? "").toContain("lat=28.62");
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();
  await expect(places(page)).toHaveCount(0);
  expect(net.calls.geocode).toHaveLength(0);   // story 1500: nothing is looked up until Confirm & proceed
});

test("The credit: Ola rows show Ola Maps under the list", async ({ page, context }) => {
  await onMap(page, context);
  await box(page).pressSequentially("sam");
  await expect(places(page).getByRole("button")).toHaveCount(2);
  const credit = places(page).locator(".ui-pinmap-credit");
  await expect(credit).toHaveText("Ola Maps");
  const [list, c] = [(await places(page).getByRole("list").boundingBox())!, (await credit.boundingBox())!];
  expect(c.y).toBeGreaterThanOrEqual(list.y + list.height - 1);   // under the list
});

test("Ola does not answer: places from our own table show, with no error and no credit", async ({ page, context }) => {
  await onMap(page, context, OWN);
  await box(page).pressSequentially("sam");
  await expect(places(page).getByRole("button")).toHaveCount(1);
  await expect(places(page).getByRole("button")).toContainText("Sample Nagar");
  await expect(places(page).getByRole("alert")).toHaveCount(0);
  await expect(places(page).getByText("Ola Maps")).toHaveCount(0);
});

test("An older answer never replaces a newer one", async ({ page, context }) => {
  const net = await onMap(page, context, (url: string) => (asked(url).q === "sam" ? { ...answer("ola", [hit("Old Place", "ola")]), delayMs: 1500 } : answer("ola", [hit("New Place", "ola")])));
  await box(page).pressSequentially("sam");
  await expect.poll(() => net.calls.places.length).toBe(1);   // the slow ask is out
  await box(page).pressSequentially("p");
  await expect(places(page).getByRole("button")).toContainText("New Place");
  await page.waitForTimeout(1800);   // the old answer has come by now
  await expect(places(page).getByRole("button")).toHaveCount(1);
  await expect(places(page).getByRole("button")).toContainText("New Place");
});

const SLOW_SECOND = (url: string) => (asked(url).q === "sam" ? answer("ola", [hit("First Place", "ola")]) : { ...answer("ola", [hit("Second Place", "ola")]), delayMs: 1500 });
for (const [where, go] of [["the map", onMap], ["Deliver to", deliverTo]] as const) {
  test(`Suggestions while typing: the old rows stay until the new ones come (${where})`, async ({ page, context }) => {
    const net = await go(page, context, SLOW_SECOND);
    await box(page).pressSequentially("sam");
    await expect(places(page).getByRole("button")).toContainText("First Place");
    await box(page).pressSequentially("p");
    await expect.poll(() => net.calls.places.length).toBe(2);   // the slow ask is out
    await box(page).pressSequentially("l");   // a slow answer never blocks typing
    await expect(box(page)).toHaveValue("sampl");
    await page.waitForTimeout(700);   // both slow asks are still out
    await expect(places(page).getByRole("button")).toContainText("First Place");
    await expect(page.getByText("Searching…")).toHaveCount(0);
    await expect(places(page).getByRole("button")).toContainText("Second Place");
    await expect(places(page).getByRole("button")).toHaveCount(1);
    await box(page).fill("sa");   // under 3 letters: the rows go at once
    await expect(places(page).getByRole("button")).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(net.calls.places.map((u) => asked(u).q)).toEqual(["sam", "samp", "sampl"]);
  });
}

test("Deliver to box: the same places while typing, asked at the phone's place, with the credit", async ({ page, context }) => {
  const net = await deliverTo(page, context, OLA);
  await box(page).pressSequentially("sam");
  await expect(page.getByText("Places · 2 found")).toBeVisible();
  expect(net.calls.places).toHaveLength(1);
  const a = asked(net.calls.places[0]);
  expect([a.q, a.lat, a.lng]).toEqual(["sam", PHONE.latitude, PHONE.longitude]);
  await expect(places(page).locator(".ui-pinmap-credit")).toHaveText("Ola Maps");
  await places(page).getByRole("button").first().click();   // a pick still opens the pin map at the place
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect.poll(() => net.calls.serve.at(-1) ?? "").toContain("lat=28.61");
  expect(net.calls.geocode).toHaveLength(0);
});
