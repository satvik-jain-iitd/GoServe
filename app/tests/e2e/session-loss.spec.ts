// Story 1580, root cause study: every path that can take the customer's sign-in away, run with real in-page actions against the stand-in server.
// Each case ends on the Bill: Place order must make exactly one order, never with the anon key as the bearer. Story 1586 changed P2, P3 and P6a (a signed-in customer whose login is gone meets the wall, never a guest order) and removed P6b (a guest never reaches the Bill: the wall stops it and place() throws SessionEnded for a guest, so the case cannot run). Notes on each path: docs in the PR (rca1580).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, phoneAt, SESSION } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (exp: number) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: SESSION, role: "authenticated", is_anonymous: true, exp })}.sig`;

async function atBill(context: BrowserContext, page: Page, guest = false) {
  const net = await setup(context, page, [], { pin: null });
  net.state.anonymous = guest;   // a guest is an anonymous user; the default stand-in user is a signed-in one
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneAt(context, HOME);
  await page.goto("/customer/");
  await openBill(page);
  return net;
}
async function openBill(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
}
const placeOnce = async (page: Page, net: { calls: { place: { headers: Record<string, string> }[] } }) => {
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.calls.place).toHaveLength(1);
  expect(net.calls.place[0].headers.authorization).not.toBe("Bearer anon-test");   // never the anon key as the bearer
};

test("P1 the phone's storage is lost (iOS eviction, cleared site data), the app is reopened: a new sign-in is made and the order is placed", async ({ page, context }) => {
  const net = await atBill(context, page);
  const before = net.calls.signups;
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
  await page.reload();
  await page.getByLabel("Phone").fill("9876543210");   // the Bill is kept across the reopen
  await placeOnce(page, net);
  expect(net.calls.signups).toBeGreaterThan(before);   // the reopen signed in again, anonymously
});

const wall = (page: Page) => expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();   // story 1586: the sign-in wall

test("P2 the stored sign-in is lost while the Bill is open (no reload): Place order shows the sign-in wall, no order (story 1586)", async ({ page, context }) => {
  const net = await atBill(context, page);
  net.state.anonymous = true;   // whoever asks the server now is a guest
  await page.evaluate(() => { localStorage.setItem("gs-device-user", "owner"); for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k); });
  await page.getByRole("button", { name: /Place order/ }).click();
  await wall(page);
  expect(net.calls.place).toHaveLength(0);
});

test("P3 the admin app's Sign out (real button, a second tab, same origin) while the Bill is open: the customer tab shows the sign-in wall, no order (story 1586)", async ({ page, context }) => {
  const net = await atBill(context, page);
  await page.evaluate(() => localStorage.setItem("gs-device-user", "owner"));   // a real owner holds the phone
  const admin = await context.newPage();
  net.state.admin = true;
  net.state.userEmail = "satvik.jain@example.com";
  await context.route("https://test.supabase.co/auth/v1/logout**", (r) => { net.state.anonymous = true; net.state.admin = false; return r.fallback(); });
  await admin.goto("/admin/");
  await admin.getByRole("button", { name: "Settings", exact: true }).click();
  await admin.getByRole("region", { name: "You" }).getByRole("button", { name: /Sign out/ }).click();
  await expect(admin.getByRole("heading", { name: "Sign in to run the city" })).toBeVisible();
  await admin.close();
  await wall(page);
  expect(net.calls.place).toHaveLength(0);
});


test("P5 the refresh token fails inside supabase-js (an expired stored session, the server refuses the refresh): the session is dropped, a new one is made, the order is placed", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneAt(context, HOME);
  await context.route("https://test.supabase.co/auth/v1/token**", (r) => r.fulfill({ status: 400, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }) }));
  await context.addInitScript(([id, token]) => {
    if (localStorage.getItem("seeded-1580")) return;
    localStorage.setItem("seeded-1580", "1");
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ access_token: token, refresh_token: "old", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) - 600, user: { id, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  }, [SESSION, jwt(Math.floor(Date.now() / 1000) - 600)] as const);
  await page.goto("/customer/");
  await openBill(page);
  await placeOnce(page, net);
  expect(net.calls.signups).toBeGreaterThan(0);
});

// P6: the server ended this phone's session (another sign-out ended it everywhere) but the stored token still looks valid.
async function revoked(context: BrowserContext, page: Page, net: Awaited<ReturnType<typeof atBill>>) {
  const stale = await page.evaluate(() => JSON.parse(localStorage.getItem("sb-test-auth-token") ?? "{}").access_token as string);
  const json = { "access-control-allow-origin": "*", "content-type": "application/json" };
  await context.route("https://test.supabase.co/auth/v1/token**", (r) => r.fulfill({ status: 400, headers: json, body: JSON.stringify({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }) }));
  const fresh = jwt(Math.floor(Date.now() / 1000) + 7200);
  await context.route("https://test.supabase.co/auth/v1/signup", (r) => { net.calls.signups++; return r.fulfill({ status: 200, headers: json, body: JSON.stringify({ access_token: fresh, token_type: "bearer", expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, refresh_token: "r2", user: { id: "7e57ab1e-0000-4000-8000-0000000000b2", aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }) }); });
  const events: string[] = [];
  const profiles: { user_id: string; phone: string }[] = [];
  await context.route("https://test.supabase.co/rest/v1/customers**", (r) => {
    if (r.request().method() === "POST") { events.push("profile"); profiles.push(JSON.parse(r.request().postData() ?? "{}")); }
    return r.fallback();
  });
  await context.route("https://test.supabase.co/functions/v1/orders", (r) => {
    if (r.request().method() === "OPTIONS") return r.fallback();
    const bearer = r.request().headers().authorization ?? "";
    events.push(bearer === `Bearer ${stale}` ? "order:stale" : "order:fresh");
    if (bearer === `Bearer ${stale}`) return r.fulfill({ status: 401, headers: json, body: JSON.stringify({ ok: false, error: "unauthorized" }) });
    return r.fallback();
  });
  return { events, profiles };
}

test("P6a a PHONE user whose session the server ended: no order, the sign-in wall shows (story 1586)", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.anonymous = false;   // a signed-in phone user
  net.state.addresses = [HOME];
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await phoneAt(context, HOME);
  await page.goto("/customer/");
  await openBill(page);
  const rec = await revoked(context, page, net);
  net.state.anonymous = true;   // the server's new session is a guest
  await page.getByRole("button", { name: /Place order/ }).click();
  await wall(page);
  expect(rec.events).toEqual(["profile", "order:stale"]);   // the profile is the one saved before the order; no second order, no second profile
  expect(net.calls.place).toHaveLength(0);
});
