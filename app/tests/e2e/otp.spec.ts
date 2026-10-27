// Story #551 (layer of #339): the phone code at checkout. Boards O1 to O9. The otp function and Supabase Auth are answered by the test.
// The gate is off unless VITE_OTP_GATE=1 or this phone has gs-otp-gate=1 (the tests set it). The code is never shown by the app.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, SESSION, scan as axeScan } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
type Otp = { sends: any[]; verifies: any[]; claims: any[]; authOtp: any[]; authVerify: any[]; send: { status: number; body: any }; verify: { status: number; body: any }; claim: { status: number; body: any } };

async function withOtp(context: BrowserContext, page: Page, initial: Partial<Otp> = {}) {
  const net = await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  const otp: Otp = { sends: [], verifies: [], claims: [], authOtp: [], authVerify: [],
    send: { status: 200, body: { ok: true, expires_in_s: 600 } }, verify: { status: 200, body: { ok: true, phone: "919876543210", user_id: SESSION } },
    claim: { status: 200, body: { ok: true, orders: 1 } }, ...initial };
  const json = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/functions/v1/otp/*", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const which = req.url().split("/").pop()!;
    const body = JSON.parse(req.postData() ?? "{}");
    if (which === "send") { otp.sends.push(body); return json(route, otp.send.status, otp.send.body); }
    if (which === "verify") { otp.verifies.push(body); return json(route, otp.verify.status, otp.verify.body); }
    otp.claims.push({ body, auth: req.headers()["authorization"] });
    return json(route, otp.claim.status, otp.claim.body);
  });
  await context.route("https://test.supabase.co/auth/v1/otp**", async (route) => { otp.authOtp.push(JSON.parse(route.request().postData() ?? "{}")); return json(route, 200, {}); });
  await context.route("https://test.supabase.co/auth/v1/verify**", async (route) => {
    otp.authVerify.push(JSON.parse(route.request().postData() ?? "{}"));
    return json(route, 200, { access_token: "old-account-token", token_type: "bearer", expires_in: 3600, refresh_token: "r2",
      user: { id: "old-user", aud: "authenticated", role: "authenticated", is_anonymous: false, phone: "919876543210", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
  });
  return { net, otp };
}

async function toBill(page: Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4, Green Park");
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Confirm your number" });
async function typeCode(page: Page, code: string) { await page.getByLabel("Digit 1").pressSequentially(code); }
async function toCodeStep(page: Page, phone = "9876543210") {
  await page.getByRole("button", { name: /Place order/ }).click();
  await dialog(page).getByLabel("Mobile number").fill(phone);
  await dialog(page).getByRole("button", { name: "Send code" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Enter the 6 digit code" })).toBeVisible();
}

test("S1 a guest at checkout enters the number and the code, the phone is linked and the order goes on", async ({ page, context }) => {
  const { net, otp } = await withOtp(context, page);
  await toBill(page);
  await expect(page.getByLabel("Phone")).toHaveCount(0);   // the sheet asks the number now
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(dialog(page).getByRole("heading", { name: "Your mobile number" })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Send code" })).toBeDisabled();
  await dialog(page).getByLabel("Mobile number").fill("9876543210");
  await dialog(page).getByRole("button", { name: "Send code" }).click();
  await expect(dialog(page).getByText("Sent to +91 98765 43210")).toBeVisible();
  expect(otp.sends).toEqual([{ phone: "9876543210" }]);
  await expect(dialog(page).getByRole("button", { name: "Verify" })).toBeDisabled();
  await typeCode(page, "482913");
  await dialog(page).getByRole("button", { name: "Verify" }).click();
  expect(otp.verifies).toEqual([{ phone: "9876543210", code: "482913" }]);
  await expect(page.getByRole("status").filter({ hasText: "Number confirmed" })).toBeVisible();
  await page.getByRole("dialog", { name: "Your name" }).getByLabel("Your name").fill("Asha");
  await page.getByRole("dialog", { name: "Your name" }).getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect.poll(() => net.calls.customerWrites.length).toBeGreaterThan(0);
  expect(net.calls.customerWrites.at(-1)!.body).toMatchObject({ name: "Asha", phone: "9876543210" });
});

test("S2 the name sheet can be skipped, and a number that is not an Indian mobile keeps Send code off", async ({ page, context }) => {
  await withOtp(context, page);
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await dialog(page).getByLabel("Mobile number").fill("1234567890");
  await expect(dialog(page).getByRole("button", { name: "Send code" })).toBeDisabled();
  await dialog(page).getByLabel("Mobile number").fill("9876543210");
  await dialog(page).getByRole("button", { name: "Send code" }).click();
  await typeCode(page, "482913");
  await dialog(page).getByRole("button", { name: "Verify" }).click();
  await page.getByRole("dialog", { name: "Your name" }).getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
});

for (const [error, status, message] of [
  ["wrong_code", 422, "That code is not right."], ["code_expired", 422, "The code has expired. Ask for a new one."],
  ["too_many_attempts", 429, "Too many wrong tries. Ask for a new code."], ["no_code", 422, "Ask for a new code."],
] as const) {
  test(`S3 ${error}: the contract's words show under the boxes and nothing is placed`, async ({ page, context }) => {
    const { net } = await withOtp(context, page, { verify: { status, body: { ok: false, error, message } } });
    await toBill(page);
    await toCodeStep(page);
    await typeCode(page, "111111");
    await dialog(page).getByRole("button", { name: "Verify" }).click();
    await expect(dialog(page).getByRole("alert")).toHaveText(message);
    expect(net.calls.customerWrites).toHaveLength(0);
  });
}

test("S4 resend: a 30 second timer counts down, then Resend code asks for a new code", async ({ page, context }) => {
  await page.clock.install({ time: new Date(2026, 9, 27, 12, 0, 0) });
  const { otp } = await withOtp(context, page);
  await toBill(page);
  await toCodeStep(page);
  await expect(dialog(page).getByText("Resend code in 0:30")).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Resend code" })).toHaveCount(0);
  await page.clock.runFor(31_000);
  await dialog(page).getByRole("button", { name: "Resend code" }).click();
  expect(otp.sends).toHaveLength(2);
  await expect(dialog(page).getByText(/Resend code in 0:/)).toBeVisible();
});

test("S5 too many codes locks the resend and says why", async ({ page, context }) => {
  const { otp } = await withOtp(context, page, { send: { status: 429, body: { ok: false, error: "too_many_sends", message: "Too many codes. Try again in a few minutes." } } });
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await dialog(page).getByLabel("Mobile number").fill("9876543210");
  await dialog(page).getByRole("button", { name: "Send code" }).click();
  await expect(dialog(page).getByRole("alert")).toHaveText("Too many codes. Try again in a few minutes.");
  await expect(dialog(page).getByRole("button", { name: "Send code" })).toBeDisabled();
  expect(otp.sends).toHaveLength(1);
});

test("S6 a number the server cannot reach says so in plain words", async ({ page, context }) => {
  await withOtp(context, page, { send: { status: 502, body: { ok: false, error: "otp_unavailable" } } });
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await dialog(page).getByLabel("Mobile number").fill("9876543210");
  await dialog(page).getByRole("button", { name: "Send code" }).click();
  await expect(dialog(page).getByRole("alert")).toHaveText("Could not reach GoServe. Try again.");
});

test("S7 a number already used offers Sign in with this number: Supabase's own code, then the guest orders move", async ({ page, context }) => {
  const taken = { status: 409, body: { ok: false, error: "phone_in_use", message: "This number is already used by another account." } };
  const { net, otp } = await withOtp(context, page, { verify: taken });
  await toBill(page);
  await toCodeStep(page);
  await typeCode(page, "482913");
  await dialog(page).getByRole("button", { name: "Verify" }).click();
  await expect(dialog(page).getByRole("alert")).toHaveText("This number is already used by another account.");
  await dialog(page).getByRole("button", { name: "Sign in with this number" }).click();
  await expect.poll(() => otp.authOtp.length).toBe(1);   // Supabase's own code is asked for before the boxes are used again
  await expect(dialog(page).getByText(/Resend code in 0:/)).toBeVisible();
  expect(otp.authOtp).toHaveLength(1);
  expect(otp.authOtp[0]).toMatchObject({ phone: "+919876543210" });
  await typeCode(page, "123456");
  await dialog(page).getByRole("button", { name: "Verify" }).click();
  await expect.poll(() => otp.claims.length).toBe(1);
  expect(otp.authVerify[0]).toMatchObject({ phone: "+919876543210", token: "123456", type: "sms" });
  expect(otp.claims[0].auth).toBe("Bearer old-account-token");
  expect(typeof otp.claims[0].body.guest_token).toBe("string");
  await page.getByRole("dialog", { name: "Your name" }).getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.calls.customerWrites.length).toBeGreaterThan(0);
});

test("S8 Use another number goes back to the number box, empty", async ({ page, context }) => {
  await withOtp(context, page, { verify: { status: 409, body: { ok: false, error: "phone_in_use", message: "This number is already used by another account." } } });
  await toBill(page);
  await toCodeStep(page);
  await typeCode(page, "482913");
  await dialog(page).getByRole("button", { name: "Verify" }).click();
  await dialog(page).getByRole("button", { name: "Use another number" }).click();
  await expect(dialog(page).getByLabel("Mobile number")).toHaveValue("");
});

test("S9 a customer whose phone is already linked skips the sheet", async ({ page, context }) => {
  const { net } = await withOtp(context, page);
  await context.route("https://test.supabase.co/auth/v1/user", (route) => route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" },
    body: JSON.stringify({ id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: false, phone: "919876543210", app_metadata: {}, user_metadata: { name: "Asha" }, created_at: new Date().toISOString() }) }));
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.calls.customerWrites.at(-1)!.body).toMatchObject({ phone: "9876543210" });
});

test("S10 with the gate off (the default) the bill still asks name and phone and no sheet opens", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByLabel("Phone")).toBeVisible();
});

for (const t of ["day", "night"] as const) {
  test(`S11 the number sheet and the code sheet have no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    await withOtp(context, page);
    await toBill(page);
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(dialog(page)).toBeVisible();
    expect(await axeScan(page)).toEqual([]);
    await dialog(page).getByLabel("Mobile number").fill("9876543210");
    await dialog(page).getByRole("button", { name: "Send code" }).click();
    await expect(dialog(page).getByLabel("Digit 1")).toBeVisible();
    expect(await axeScan(page)).toEqual([]);
  });
}
