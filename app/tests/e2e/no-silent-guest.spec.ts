// Story 1586: a customer who signed in is never turned into a guest without notice. When the stored login is gone or refused (app open, Place order, a 401, a Sign out in another tab)
// the customer app shows the sign-in wall, sends no order, and keeps the bag. Each case starts as a signed-in customer on the Bill with the device keys saying a real owner holds the phone.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, phoneAt, SESSION } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const JSONH = { "access-control-allow-origin": "*", "content-type": "application/json" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const GUEST_ID = "7e57ab1e-0000-4000-8000-0000000000b2";

async function atBill(context: BrowserContext, page: Page) {
  const net = await setup(context, page, [], { pin: null });   // the stand-in user is a signed-in (not anonymous) one
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneAt(context, HOME);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.evaluate((id) => { localStorage.setItem("gs-device-user", id); localStorage.removeItem("gs-device-guest"); }, SESSION);   // a real owner holds the phone
  return net;
}
// From now on a new login is an anonymous user with another id (what the server makes when a refused session is replaced).
async function guestSignups(context: BrowserContext, net: Awaited<ReturnType<typeof atBill>>) {
  net.state.anonymous = true;   // the server now answers "guest" for whoever asks
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: GUEST_ID, role: "authenticated", is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  await context.route("https://test.supabase.co/auth/v1/signup", (r) => r.fulfill({ status: 200, headers: JSONH, body: JSON.stringify({ access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "rg", user: { id: GUEST_ID, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }) }));
}
const dropLogin = (page: Page) => page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
const bag = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("gs-draft") ?? "{}").cart);
const wall = (page: Page) => expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

test("G1 the app opens with the stored login gone and a real owner on the phone: the wall shows, no order is sent, the bag stays", async ({ page, context }) => {
  const net = await atBill(context, page);
  expect(await bag(page)).toEqual({ d1: 1 });
  await dropLogin(page);
  await guestSignups(context, net);
  await page.reload();
  await wall(page);
  await page.waitForTimeout(500);   // a wipe would come on the sign-in event, a moment after the wall
  expect(await bag(page)).toEqual({ d1: 1 });
  expect(net.calls.place).toHaveLength(0);
});

test("G2 the stored login is gone while the Bill is open: Place order shows the wall, sends no order, keeps the bag", async ({ page, context }) => {
  const net = await atBill(context, page);
  await dropLogin(page);
  await guestSignups(context, net);
  await page.getByRole("button", { name: /Place order/ }).click();
  await wall(page);
  expect(net.calls.place).toHaveLength(0);
  expect(await bag(page)).toEqual({ d1: 1 });
});

test("G3 the order call answers 401 and the refresh is refused for a signed-in user: the wall shows, one request, no guest order", async ({ page, context }) => {
  const net = await atBill(context, page);
  await guestSignups(context, net);
  await context.route("https://test.supabase.co/auth/v1/token**", (r) => r.fulfill({ status: 400, headers: JSONH, body: JSON.stringify({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }) }));
  let orders = 0;
  await context.route("https://test.supabase.co/functions/v1/orders", (r) => {
    if (r.request().method() === "OPTIONS") return r.fallback();
    orders++;
    return r.fulfill({ status: 401, headers: JSONH, body: JSON.stringify({ ok: false, error: "unauthorized" }) });
  });
  await page.getByRole("button", { name: /Place order/ }).click();
  await wall(page);
  expect(orders).toBe(1);
  expect(net.calls.place).toHaveLength(0);
  expect(await bag(page)).toEqual({ d1: 1 });
});

test("G4 the admin app's Sign out in a second tab empties the shared login: the customer tab shows the wall, no guest order", async ({ page, context }) => {
  const net = await atBill(context, page);
  const admin = await context.newPage();
  net.state.admin = true;
  net.state.userEmail = "satvik.jain@example.com";
  await context.route("https://test.supabase.co/auth/v1/logout**", (r) => { net.state.anonymous = true; net.state.admin = false; return r.fallback(); });
  await admin.goto("/admin/");
  await admin.getByRole("button", { name: "City", exact: true }).click();
  await admin.getByRole("region", { name: "You" }).getByRole("button", { name: /Sign out/ }).click();
  await expect(admin.getByRole("heading", { name: "Sign in to run the city" })).toBeVisible();
  await admin.close();
  await wall(page);
  expect(net.calls.place).toHaveLength(0);
  expect(await bag(page)).toEqual({ d1: 1 });
});
