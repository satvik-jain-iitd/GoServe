// Story #554: Order alerts on You (boards U1 and U2). The browser's push is stubbed; the network is answered by the test.
// On the web the row keeps the web push (save_push). A phone wrapper (Android or iOS) that hands over a device token also registers it with /push/register.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

async function stubWebPush(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => "granted";
    const fake = { pushManager: { subscribe: async () => ({ toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "PKEY", auth: "AKEY" } }) }) } };
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  });
}
async function registerRoute(context: BrowserContext, answer: { status: number; body: unknown } = { status: 200, body: { ok: true } }) {
  const seen: { body: any; auth: string | undefined }[] = [];
  await context.route("https://test.supabase.co/functions/v1/push/register", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    seen.push({ body: JSON.parse(req.postData() ?? "{}"), auth: req.headers()["authorization"] });
    return route.fulfill({ status: answer.status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(answer.body) });
  });
  return seen;
}
const toYou = async (page: Page) => { await page.goto("/customer/"); await page.getByRole("button", { name: "You" }).click(); };

test("S1 the row says Tap to turn on, a tap saves the web push and the row says On for this phone", async ({ page, context }) => {
  await stubWebPush(context);
  const net = await setup(context, page);
  const seen = await registerRoute(context);
  await toYou(page);
  const row = page.getByRole("switch", { name: /Order alerts/ });
  await expect(page.getByText("Tap to turn on")).toBeVisible();
  await expect(row).not.toBeChecked();
  await row.click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "save_push").length).toBe(1);
  await expect(page.getByText("On for this phone")).toBeVisible();
  await expect(row).toBeChecked();
  expect(seen).toHaveLength(0);   // a browser has no device token: /push/register is for the phone wrappers
});

test("S2 a phone wrapper that hands over a device token is registered with its platform", async ({ page, context }) => {
  await stubWebPush(context);
  await context.addInitScript(() => { (window as unknown as { GoServeNative: unknown }).GoServeNative = { platform: "android", pushToken: async () => "tok-a" }; });
  await setup(context, page);
  const seen = await registerRoute(context);
  await toYou(page);
  await page.getByRole("switch", { name: /Order alerts/ }).click();
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0].body).toEqual({ platform: "android", token: "tok-a" });
  expect(seen[0].auth).toMatch(/^Bearer /);
  await expect(page.getByText("On for this phone")).toBeVisible();
});

test("S3 when the device cannot be registered the row says so and stays off", async ({ page, context }) => {
  await stubWebPush(context);
  await context.addInitScript(() => { (window as unknown as { GoServeNative: unknown }).GoServeNative = { platform: "ios", pushToken: async () => "tok-i" }; });
  await setup(context, page);
  await registerRoute(context, { status: 502, body: { ok: false, error: "push_unavailable" } });
  await toYou(page);
  await page.getByRole("switch", { name: /Order alerts/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not turn alerts on. Try again in a minute." })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Order alerts/ })).not.toBeChecked();
});

test("S4 blocked in the phone settings: the switch is off and locked, with the line on how to unblock (board U4)", async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(Notification, "permission", { get: () => "denied", configurable: true }); });
  await setup(context, page);
  await toYou(page);
  await expect(page.getByText("Blocked in your phone settings. Settings › Notifications › GoServe, then come back.")).toBeVisible();
  const row = page.getByRole("switch", { name: /Order alerts/ });
  await expect(row).not.toBeChecked();
  await expect(row).toBeDisabled();
});

// Story #609 (boards U1, U3): alerts already allowed on this phone; the switch can be turned off and on again.
async function stubGranted(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => { (window as unknown as { __asked: boolean }).__asked = true; return "granted"; };
    const w = window as unknown as { __unsubscribed: number };
    w.__unsubscribed = 0;
    const sub = { endpoint: "https://push.example/abc", unsubscribe: async () => { w.__unsubscribed++; return true; }, toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "PKEY", auth: "AKEY" } }) };
    const fake = { pushManager: { getSubscription: async () => sub, subscribe: async () => sub } };
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  });
}

test("S5 alerts on can be turned off: the server row goes, the phone unsubscribes, the row says Off for this phone; on again needs no prompt (U3)", async ({ page, context }) => {
  await stubGranted(context);
  const net = await setup(context, page);
  const removed: string[] = [];
  await context.route(/test\.supabase\.co\/rest\/v1\/push_subscriptions/, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    removed.push(req.method() + " " + decodeURIComponent(req.url()));
    return route.fulfill({ status: 204, headers: CORS });
  });
  await toYou(page);
  const row = page.getByRole("switch", { name: /Order alerts/ });
  await expect(page.getByText("On for this phone")).toBeVisible();
  await expect(row).toBeChecked();
  await expect(row).toBeEnabled();
  await row.click();
  await expect(page.getByText("Off for this phone. Tap to turn on.")).toBeVisible();
  await expect(row).not.toBeChecked();
  await expect(row).toBeEnabled();
  expect(removed.filter((r) => r.startsWith("DELETE") && r.includes("endpoint=eq.https://push.example/abc"))).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { __unsubscribed: number }).__unsubscribed)).toBe(1);
  const saves = () => net.calls.rpc.filter((c) => c.name === "save_push").length;
  const before = saves();
  await page.reload();
  await page.getByRole("button", { name: "You" }).click();
  await expect(page.getByText("Off for this phone. Tap to turn on.")).toBeVisible();   // remembered
  expect(saves()).toBe(before);                                                      // and the start-up re-save did not bring it back
  await page.getByRole("switch", { name: /Order alerts/ }).click();
  await expect(page.getByText("On for this phone")).toBeVisible();
  await expect.poll(saves).toBe(before + 1);
  expect(await page.evaluate(() => (window as unknown as { __asked?: boolean }).__asked ?? false)).toBe(false);
});

for (const t of ["day", "night"] as const) {
  test(`S5 You with alerts off and on has no serious contrast or role violation in ${t}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    await stubWebPush(context);
    await setup(context, page);
    await toYou(page);
    expect(await axeScan(page)).toEqual([]);
    await page.getByRole("switch", { name: /Order alerts/ }).click();
    await expect(page.getByText("On for this phone")).toBeVisible();
    expect(await axeScan(page)).toEqual([]);
  });
}
