// Story #609 (boards U3, U4), release copy for main: the Order alerts switch can be turned off and on again; blocked is locked with the settings line. The browser's push is stubbed; the network is answered by the test.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const toYou = async (page: Page) => { await page.goto("/customer/"); await page.getByRole("button", { name: "You" }).click(); };

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
  await expect(page.getByRole("switch", { name: /Order alerts/ })).toBeChecked();
  await expect.poll(saves).toBe(before + 1);
  expect(await page.evaluate(() => (window as unknown as { __asked?: boolean }).__asked ?? false)).toBe(false);
});

