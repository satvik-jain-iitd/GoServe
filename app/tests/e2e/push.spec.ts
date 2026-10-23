// Story A7 (#154): the customer allows notifications once and the app saves the push subscription. The browser's push is stubbed; the network is answered by the test.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

test("S1 Allow a reminder asks permission, subscribes and saves the subscription for this customer", async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => "granted";
    const fake = { pushManager: { subscribe: async () => ({ toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "PKEY", auth: "AKEY" } }) }) } };
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  });
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await page.getByRole("button", { name: "Allow a reminder when your order is ready?" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "save_push").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "save_push")!.body).toEqual({ p_endpoint: "https://push.example/abc", p_p256dh: "PKEY", p_auth: "AKEY" });
});

test("S2 the built app carries the push service worker with this project's address and key, and no secret", async ({ request }) => {
  const sw = await request.get("/push-sw.js");
  expect(sw.status()).toBe(200);
  const text = await sw.text();
  expect(text).toContain("https://test.supabase.co/rest/v1/rpc/push_latest");
  expect(text).toContain("anon-test");
  expect(text).not.toMatch(/PRIVATE|service_role/i);
});
