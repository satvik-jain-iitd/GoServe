// Story 1583: every Sign out button asks the server to end this phone's login only (scope local); only Delete account is global (the account is gone everywhere).
// Shared cases, run by Chromium (sign-out-scope.spec.ts) and by WebKit (sign-out-scope.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

// supabase-js sends POST /auth/v1/logout?scope=local|global|others. Record the scope of each call.
const watch = async (context: BrowserContext) => {
  const scopes: (string | null)[] = [];
  await context.route("https://test.supabase.co/auth/v1/logout**", (r) => { scopes.push(new URL(r.request().url()).searchParams.get("scope")); return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" }); });
  return scopes;
};

export function signOutScope() {
  test("S1 admin City tab Sign out is local", async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.admin = true;
    const scopes = await watch(context);
    await page.goto("/admin/");
    await page.getByRole("button", { name: "City", exact: true }).click();
    await page.getByRole("region", { name: "You" }).getByRole("button", { name: /Sign out/ }).click();
    await expect.poll(() => scopes).toEqual(["local"]);
  });

  test("S2 admin 'Not an admin' Sign out is local", async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.anonymous = false;
    net.state.admin = false;
    net.state.userEmail = "x@example.com";
    const scopes = await watch(context);
    await page.goto("/admin/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect.poll(() => scopes).toEqual(["local"]);
  });

  test("S3 kitchen Sign out is local", async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.kitchen = "k-1";
    net.state.userEmail = "sunita.devi@gmail.com";
    const scopes = await watch(context);
    await page.goto("/kitchen/");
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByTestId("signed-in-row").getByRole("button", { name: "Sign out" }).click();
    await expect.poll(() => scopes).toEqual(["local"]);
  });

  test("S4 rider Sign out is local", async ({ page, context }) => {
    const net = await setup(context, page, [{ ...order("delivered"), rider_id: SESSION }]);
    net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
    const scopes = await watch(context);
    await page.goto("/rider/");
    await page.getByRole("button", { name: "Me", exact: true }).click();
    await page.getByText("Sign out").click();
    await expect.poll(() => scopes).toEqual(["local"]);
  });

  test("S5 the console's signed-in customer Sign out is local", async ({ page, context }) => {
    await setup(context, page);
    await context.route("https://test.supabase.co/auth/v1/user", (r) => r.request().method() === "OPTIONS"
      ? r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } })
      : r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: false, email: "asha@example.com", user_metadata: { full_name: "Asha Rao" }, app_metadata: {}, created_at: "2026-10-22T10:00:00Z" }) }));
    const scopes = await watch(context);
    await page.goto("/console/");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect.poll(() => scopes).toEqual(["local"]);
  });

  test("S6 Delete my account stays global", async ({ page, context }) => {
    await setup(context, page);
    const scopes = await watch(context);
    await page.goto("/customer/");
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => scopes).toEqual(["global"]);
  });

  test("S7 Forget me on this phone is local", async ({ page, context }) => {
    await setup(context, page);
    const scopes = await watch(context);
    await page.goto("/customer/");
    await page.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("button", { name: "Sign out of this phone" }).click();
    await page.getByRole("button", { name: "Yes, forget" }).click();
    await expect.poll(() => scopes).toEqual(["local"]);
  });
}
