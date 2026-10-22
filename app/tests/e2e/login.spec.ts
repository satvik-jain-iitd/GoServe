// Story S-M1 (#117): Continue with Google links to the anonymous user; after sign-in the name shows. Supabase and Google are answered by the test.
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
  await page.goto("/customer/");
  await page.getByTestId("google-signin").click();
  await expect(page).toHaveURL("https://accounts.google.test/auth");
  expect(asked).toHaveLength(1);
  const u = new URL(asked[0]);
  expect(u.searchParams.get("provider")).toBe("google");
  expect(u.searchParams.get("redirect_to")).toMatch(/\/customer\/$/);
});

test("S2 a signed-in user sees the name and no button", async ({ page, context }) => {
  await setup(context, page, []);
  await context.route("https://test.supabase.co/auth/v1/user", (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(user({ is_anonymous: false, email: "asha@example.com", user_metadata: { full_name: "Asha Rao" } })) }));
  await page.goto("/customer/");
  await expect(page.getByTestId("signed-in")).toHaveText("Signed in as Asha Rao");
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
});

test("S3 an anonymous user keeps the same session and sees the button", async ({ page, context }) => {
  await setup(context, page, []);
  await page.goto("/customer/");
  await expect(page.getByTestId("google-signin")).toBeVisible();
  await expect(page.getByTestId("signed-in")).toHaveCount(0);
});
