// Story #891, board M7-MenuEmpty: a kitchen with no dishes yet is not an offline kitchen.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

// The browser's push is stubbed, as in open-alert.spec.ts (story #718).
const stubPush = (context: import("@playwright/test").BrowserContext) => context.addInitScript(() => {
  Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true });
  const fake = { pushManager: { subscribe: async () => ({ toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "PKEY", auth: "AKEY" } }) }), getSubscription: async () => null } };
  Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
  (window as unknown as { PushManager: unknown }).PushManager = function () {};
});

test("S1 zero dishes and the network on: the menu shows the empty box, not the offline screen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [];
  await page.goto("/customer/");
  await expect(page.getByText("No dishes on the menu yet.")).toBeVisible();
  await expect(page.getByText("Hauz Khas Kitchen is still adding its dishes. Nothing to order right now.")).toBeVisible();
  await expect(page.getByText("Your internet is fine. The kitchen has nothing listed yet.")).toBeVisible();
  await expect(page.getByText("Could not connect to the internet.")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();   // the header and tabs stay
  await expect(page.getByRole("button", { name: /Change area/ })).toBeVisible();
});

test("S2 no network and nothing saved: the offline screen still shows", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menuUp = false;
  await page.goto("/customer/");
  await expect(page.getByText("Could not connect to the internet.")).toBeVisible();
  await expect(page.getByText("No dishes on the menu yet.")).toHaveCount(0);
});

test("S3 no network and a saved menu: the saved menu still shows with its line", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByText("Butter Chicken").first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  net.state.menuUp = false;
  await page.reload();
  await expect(page.getByText("Butter Chicken").first()).toBeVisible();
  await expect(page.getByText("No connection. Showing the menu you saw last.")).toBeVisible();
  await expect(page.getByText("No dishes on the menu yet.")).toHaveCount(0);
});

test("S4 Tell me when the menu is ready asks once and answers We will tell you", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [];
  await stubPush(context);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Tell me when the menu is ready" }).click();
  await expect(page.getByText("We will tell you when the menu is ready.")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "open_alert_add_v2")).toHaveLength(1);
});

test("S5 Try another pin code goes to the pin screen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = [];
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Try another pin code" }).click();
  await expect(page.getByText("No dishes on the menu yet.")).toHaveCount(0);
});
