// Story S-M1 (#117), moved to the demo console by #224 (the customer app never shows the button): Continue with Google links to the anonymous user; after sign-in the name shows. Supabase and Google are answered by the test.
import { test, expect } from "@playwright/test";
import { setup, SESSION } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const user = (over: object) => ({ id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: "2026-10-22T10:00:00Z", ...over });

test("S1 Continue with Google asks Supabase to link Google to the current user and goes to Google", async ({ page, context }) => {
  await setup(context, page, []);
  const asked: string[] = [];
  await context.route("https://test.supabase.co/auth/v1/user", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(user({})) }));
  await context.route("https://test.supabase.co/auth/v1/user/identities/authorize**", (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    asked.push(r.request().url());
    return r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ url: "https://accounts.google.test/auth" }) });
  });
  await context.route("https://accounts.google.test/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Google</h1>" }));
  await page.goto("/console/");
  await page.getByTestId("google-signin").click();
  await expect(page).toHaveURL("https://accounts.google.test/auth");
  expect(asked).toHaveLength(1);
  const u = new URL(asked[0]);
  expect(u.searchParams.get("provider")).toBe("google");
  expect(u.searchParams.get("redirect_to")).toMatch(/\/$/);   // the console root since #224
});

test("S2 a signed-in user sees the name and no button", async ({ page, context }) => {
  await setup(context, page, []);
  await context.route("https://test.supabase.co/auth/v1/user", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(user({ is_anonymous: false, email: "asha@example.com", user_metadata: { full_name: "Asha Rao" } })) }));
  await page.goto("/console/");
  await expect(page.getByTestId("signed-in")).toHaveText("Signed in as Asha Rao");
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
});

test("S3 an anonymous user keeps the same session and sees the button", async ({ page, context }) => {
  await setup(context, page, []);
  await page.goto("/console/");
  await expect(page.getByTestId("google-signin")).toBeVisible();
  await expect(page.getByTestId("signed-in")).toHaveCount(0);
});

test("S4 a Google identity already on another user: the friendly line, then the app signs in to that user; the raw words never show (story #635)", async ({ page, context }) => {
  await setup(context, page, []);
  const authorize: string[] = [];
  await context.route(/test\.supabase\.co\/auth\/v1\/authorize/, (route) => { authorize.push(route.request().url()); return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" }); });
  await page.goto("/console/?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user");
  await expect.poll(() => authorize.length).toBe(1);
  expect(authorize[0]).toContain("provider=google");
  await expect(page.getByText("Identity is already linked")).toHaveCount(0);
});

test("S4b another failure from Google shows our own line once and clears the address", async ({ page, context }) => {
  await setup(context, page, []);
  await page.goto("/console/?error=access_denied&error_description=Access+denied");
  await expect(page.getByRole("alert")).toHaveText("Could not sign in with Google. Try again.");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("google-signin")).toBeVisible();
});

test("S4c back from Google the customer app opens on You, not the menu (story #635)", async ({ page, context }) => {
  await context.addInitScript(() => { try { window.sessionStorage.setItem("gs-return", "account"); } catch { /* the menu opens */ } });
  await setup(context, page, []);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "You" })).toBeVisible();
});

// Story #653 (row T3): the signed-in line and its Sign out button are ink on the light box, Day and Night (board N1). White on lime was unreadable on Night.
for (const theme of ["day", "night"]) {
  test(`S-653 ${theme}: the signed-in line and Sign out are ink on the box`, async ({ page, context }) => {
    await context.addInitScript((t) => { try { localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
    await setup(context, page, []);
    await context.route("https://test.supabase.co/auth/v1/user", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(user({ is_anonymous: false, email: "asha@example.com", user_metadata: { full_name: "Asha Rao" } })) }));
    await page.goto("/console/");
    const colour = (loc: import("@playwright/test").Locator) => loc.evaluate((el) => { const s = getComputedStyle(el); return { color: s.color, border: s.borderTopColor }; });
    expect((await colour(page.getByTestId("signed-in"))).color).toBe("rgb(38, 53, 40)");
    const out = await colour(page.getByRole("button", { name: "Sign out" }));
    expect(out).toEqual({ color: "rgb(38, 53, 40)", border: "rgb(38, 53, 40)" });
  });
}
