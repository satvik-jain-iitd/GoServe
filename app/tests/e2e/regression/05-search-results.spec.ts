// Regression, screen 5: C8 Search results. Cases: .claude/handoff/qa/screens/05-C8.md (epic #1196, story #1197). Reached with the shared step STEPS["deliver-to-search"] (a submitted search for "green park").
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
const PLACES = "https://test.supabase.co/functions/v1/place-search**";
const GEOCODE = "https://test.supabase.co/functions/v1/geocode**";
const SERVE = "https://test.supabase.co/functions/v1/serviceability**";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search an area or address" });
const deliverHeading = (page: Page) => page.getByRole("heading", { name: "Deliver to", exact: true });
const pinMap = (page: Page) => page.getByRole("region", { name: "Pin map" });

// Later routes win over the shared step's answers. Each one answers the browser's preflight too.
async function answer(context: import("@playwright/test").BrowserContext, url: string, status: number, body: object) {
  await context.route(url, (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) })));
}

test("TC 5.1 type green park: Saved · 1 match with the bold match, Places with a chip on each place", async ({ page, context }) => {
  await STEPS["deliver-to-search"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Saved · 1 match" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deliver to Home" }).locator("b")).toHaveText("Green Park");   // the saved row's match in bold
  await expect(page.getByRole("heading", { name: "Places · 2 found" })).toBeVisible();
  await expect(page.locator(".ui-place-row b").first()).toHaveText("Green Park");
  await expect(page.locator(".ui-tag.ready", { hasText: "We deliver here" })).toHaveCount(1);   // lime chip on the served place
  await expect(page.locator(".ui-tag.placed", { hasText: "Not yet" })).toHaveCount(1);   // outline chip on the place we do not reach
});

test("TC 5.2 tap We deliver here: the pin map opens on that place, search stays on the map", async ({ page, context }) => {
  const looked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/functions/v1/geocode")) looked.push(r.url()); });   // the map asks for the words at the place it rests on
  await STEPS["deliver-to-search"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Places · 2 found" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "We deliver here" }).getByRole("button").click();
  await expect(pinMap(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeVisible();
  await expect.poll(() => looked.at(-1) ?? "").toContain("lat=28.55");   // the place's point (28.5599, 77.2065), not the phone's
  expect(looked.at(-1)).toContain("lng=77.20");
  await expect(deliverHeading(page)).toHaveCount(0);
  await expect(pinMap(page).getByRole("button", { name: "Search an area or address" })).toBeVisible();   // search is on the map
});

test("TC 5.3 tap the saved row: that address is chosen and the menu opens for it", async ({ page, context }) => {
  await STEPS["deliver-to-search"](context, page, PATH);
  await expect(page.getByRole("button", { name: "Deliver to Home" })).toBeVisible();
  await page.getByRole("button", { name: "Deliver to Home" }).click();
  await expect(deliverHeading(page)).toHaveCount(0);
  await expect(page.getByText("Butter Chicken").first()).toBeVisible();   // the menu is on screen
  await expect(page.getByRole("button", { name: /^Home\b/ })).toBeVisible();   // and it carries the chosen address
});

test("TC 5.4 tap a Not yet place: the pin map opens on it with Invite the founders here", async ({ page, context }) => {
  await STEPS["deliver-to-search"](context, page, PATH);
  await answer(context, GEOCODE, 200, { ok: true, address: "Green Park Extension, Delhi", pin: "110049", locality: "Green Park Extension", town: "Delhi" });   // the pin there is a valid pin no kitchen reaches
  await answer(context, SERVE, 200, { ok: true, serviceable: false, request_here: false, kitchens: [] });
  await expect(page.getByRole("heading", { name: "Places · 2 found" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Not yet" }).getByRole("button").click();
  await expect(pinMap(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite the founders here" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);
});

test("TC 5.5 a word with no match: No place found in our words, Use current location still there", async ({ page, context }) => {
  await STEPS["deliver-to-search"](context, page, PATH);
  await answer(context, PLACES, 200, { ok: true, results: [] });
  await search(page).fill("zzqxv");
  await search(page).press("Enter");
  await expect(page.getByRole("heading", { name: "Places · 0 found" })).toBeVisible();   // the results section shows, so the next line can fail
  await expect(page.getByText("No place found. Try the start of a colony name or a pin code.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use current location" })).toBeVisible();
});

test("TC 5.6 tap clear (x) (Chromium only, #1248): the box empties, the results go, the keyboard stays", async ({ page, context }) => {
  await STEPS["deliver-to-search"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Places · 2 found" })).toBeVisible();   // results shown before the clear
  const box = (await search(page).boundingBox())!;
  await search(page).click({ position: { x: box.width - 9, y: box.height / 2 } });   // the clear (x) sits at the right end of the box
  await expect(search(page)).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Saved addresses" })).toBeVisible();   // the list is back, so the results have gone
  await expect(page.getByRole("heading", { name: /^Places ·/ })).toHaveCount(0);
  await expect(search(page)).toBeFocused();
});

test("TC 5.7 type fast, 10 letters: one search after the typing stops, not 10", async ({ page, context }) => {
  let searches = 0;
  page.on("request", (r) => { if (r.method() === "GET" && r.url().includes("/functions/v1/place-search")) searches++; });
  await STEPS["deliver-to-search"](context, page, PATH);
  await expect.poll(() => searches).toBe(1);   // the shared step's own search
  await search(page).fill("");
  await search(page).pressSequentially("greenparkx", { delay: 0 });
  await expect(search(page)).toHaveValue("greenparkx");
  await expect(page.getByRole("heading", { name: /^Places ·/ })).toHaveCount(0);   // typing cleared the old results
  expect(searches).toBe(1);   // typing alone asks nobody
  await search(page).press("Enter");
  await expect(page.getByRole("heading", { name: "Places · 2 found" })).toBeVisible();
  expect(searches).toBe(2);   // one search for the whole word
});

test("TC 5.8 no network while typing: a line that search needs the internet, saved rows still match", async ({ page, context }) => {
  await STEPS["deliver-to-search"](context, page, PATH);
  await context.route(PLACES, (r) => (r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.abort("internetdisconnected")));   // the phone has no network
  await search(page).fill("green park");
  await expect(page.getByRole("heading", { name: "Saved · 1 match" })).toBeVisible();   // saved rows match without the network
  await expect(page.getByRole("button", { name: "Deliver to Home" })).toBeVisible();
  await search(page).press("Enter");
  test.fail(true, "#1201: app shows 'Could not search places. Try again.' when offline, not a line that search needs the internet");
  await expect(page.getByText(/internet/i)).toBeVisible();
});
