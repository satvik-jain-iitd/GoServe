// Story 1594: Sign out of this phone ends this phone's push subscription and removes its row before the local sign-out; a failure never blocks the sign-out. Shared cases: Chromium (sign-out-push.spec.ts) and WebKit (sign-out-push.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, stubPushOn } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

async function signOut(page: Page, context: BrowserContext, opts: { failUnsubscribe?: boolean } = {}) {
  await stubPushOn(context, opts);
  await setup(context, page, [], { pin: null });
  const calls: string[] = [];
  await context.route(/test\.supabase\.co\/rest\/v1\/push_subscriptions/, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.push(req.method() + " " + decodeURIComponent(req.url()));
    return route.fulfill({ status: 204, headers: CORS });
  });
  await page.goto("/customer/");
  await page.evaluate(() => localStorage.setItem("gs-pin", "110016"));
  await page.reload();
  await page.getByRole("button", { name: /^You: / }).click();
  await page.getByRole("button", { name: "Sign out of this phone" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign out of this phone?" });
  const unsubscribed = () => page.evaluate(() => Number(sessionStorage.getItem("unsub") ?? 0));
  const nav = page.waitForNavigation();   // the page reloads at the end of the sign-out
  await sheet.getByRole("button", { name: "Sign out", exact: true }).click();
  return { calls, nav, unsubscribed };
}

export function signOutPush() {
  test("with alerts on, Sign out of this phone removes the push row and ends the browser subscription before the reload", async ({ page, context }) => {
    const { calls, nav, unsubscribed } = await signOut(page, context);
    await nav;
    expect(await unsubscribed()).toBe(1);
    expect(calls.filter((c) => c.startsWith("DELETE") && c.includes("endpoint=eq.https://push.example/abc"))).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBeNull();
  });

  test("a browser that fails to unsubscribe still signs out", async ({ page, context }) => {
    const { nav } = await signOut(page, context, { failUnsubscribe: true });
    await nav;
    expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBeNull();
  });
}
