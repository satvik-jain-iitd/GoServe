// Story #984: on a closed menu the "Tell me when it opens" button sits 12 px under the banner, on the same left edge (the gutter), not touching it.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the Tell me button is 12 px under the Closed banner and lines up with its left edge", async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
    const fake = { pushManager: { subscribe: async () => ({ toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" } }) }), getSubscription: async () => null } };
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  });
  const net = await setup(context, page);
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  await page.goto("/customer/");
  const banner = page.locator(".ui-closed").first();
  const button = page.getByRole("button", { name: "Tell me when it opens" });
  await expect(button).toBeVisible();
  const [b, t] = await Promise.all([banner.boundingBox(), button.boundingBox()]);
  expect(Math.round(t!.y - (b!.y + b!.height)), "12 px between the banner and the button").toBe(12);
  expect(Math.round(t!.x), "the button's left edge is the banner's").toBe(Math.round(b!.x));
});
