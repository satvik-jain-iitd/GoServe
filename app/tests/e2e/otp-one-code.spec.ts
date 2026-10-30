// Story #802: a customer whose number already has an account gets ONE code, from Supabase's own phone sign-in, and their guest orders move over.
// Before this, our own code was sent and spent first, the customer was told their own number belonged to someone else, and a second SMS followed.
// The otp function, Supabase Auth and Google are all answered by the test.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1LW9sZCJ9.x";

// The number 9876543210 already has an account, so /otp/send answers sign_in and issues nothing.
async function returning(context: BrowserContext, page: Page) {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  const calls = { ourSends: [] as unknown[], ourVerifies: [] as unknown[], supabaseSends: [] as unknown[], supabaseVerifies: [] as unknown[], claims: [] as unknown[] };
  const json = (route: Parameters<Parameters<BrowserContext["route"]>[1]>[0], status: number, body: unknown) =>
    route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

  await context.route("https://test.supabase.co/functions/v1/otp/*", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const which = req.url().split("/").pop();
    const body = JSON.parse(req.postData() ?? "{}");
    if (which === "send") { calls.ourSends.push(body); return json(route, 200, { ok: true, sign_in: true }); }
    if (which === "verify") { calls.ourVerifies.push(body); return json(route, 200, { ok: true, sign_in: true }); }
    calls.claims.push(body);
    return json(route, 200, { ok: true, moved: 2 });
  });
  // Supabase's own phone sign-in: one send, then the code becomes a session for the old account.
  await context.route("https://test.supabase.co/auth/v1/otp*", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.supabaseSends.push(JSON.parse(route.request().postData() ?? "{}"));
    return json(route, 200, {});
  });
  await context.route("https://test.supabase.co/auth/v1/verify*", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.supabaseVerifies.push(JSON.parse(route.request().postData() ?? "{}"));
    return json(route, 200, { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
      user: { id: "u-old", aud: "authenticated", role: "authenticated", is_anonymous: false, phone: "919876543210", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
  });
  return calls;
}

test("S1 a number that already has an account gets one code, from the sign-in sender", async ({ page, context }) => {
  const calls = await returning(context, page);
  await page.goto("/customer/");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the 6 digit code" })).toBeVisible();
  expect(calls.ourSends).toEqual([{ phone: "9876543210" }]);        // asked once, and it issued nothing
  expect(calls.supabaseSends.length).toBe(1);                       // the only code that was sent
  expect(calls.supabaseSends[0]).toMatchObject({ phone: "+919876543210" });   // supabase-js adds its own fields around it
});

test("S2 the customer is never told their own number belongs to someone else", async ({ page, context }) => {
  await returning(context, page);
  await page.goto("/customer/");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the 6 digit code" })).toBeVisible();
  await expect(page.getByText("already used by another account")).toHaveCount(0);
  await expect(page.getByText("already has a GoServe account")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in with this number" })).toHaveCount(0);
});

test("S3 the one code signs the customer in to their own account and moves the guest orders", async ({ page, context }) => {
  const calls = await returning(context, page);
  await page.goto("/customer/");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Digit 1")).toBeEnabled();
  await page.getByLabel("Digit 1").pressSequentially("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  expect(calls.supabaseVerifies.length).toBe(1);
  expect(calls.supabaseVerifies[0]).toMatchObject({ phone: "+919876543210", token: "123456", type: "sms" });
  expect(calls.ourVerifies).toEqual([]);           // our own code store is never asked: there was no code of ours
  expect(calls.supabaseSends.length).toBe(1);      // still one SMS, not two
  expect(calls.claims.length).toBe(1);             // the guest's orders moved
});
