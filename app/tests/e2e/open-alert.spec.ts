// Story #718 (#619 layer d, board L1): a closed kitchen offers "Tell me when it opens". One tap asks the database to push once when the kitchen opens.
// Alerts are allowed first when they are not on yet. The browser's push is stubbed; the network is answered by the test.
import { test, expect, type BrowserContext } from "@playwright/test";
import { setup, scan } from "./helpers";

async function phone(context: BrowserContext, permission: "default" | "granted") {
  await context.addInitScript((perm) => {
    Object.defineProperty(Notification, "permission", { get: () => perm, configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => "granted";
    const fake = { pushManager: { subscribe: async () => ({ toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "PKEY", auth: "AKEY" } }) }), getSubscription: async () => null } };
    Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(fake), configurable: true });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  }, permission);
}
const calls = (net: Awaited<ReturnType<typeof setup>>, name: string) => net.calls.rpc.filter((c) => c.name === name);
const tell = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Tell me when it opens" });

test("S1 alerts not on yet: one tap allows them, then asks the database for this kitchen, and the button turns into a promise", async ({ page, context }) => {
  await phone(context, "default");
  const net = await setup(context, page);
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  await page.goto("/customer/");
  await expect(page.getByText(/^Kitchen closed/).first()).toBeVisible();
  await tell(page).click();
  await expect(page.getByText("We will tell you when it opens.")).toBeVisible();
  await expect(tell(page)).toHaveCount(0);
  expect(calls(net, "save_push").length).toBe(1);
  expect(calls(net, "open_alert_add_v2").map((c) => c.body)).toEqual([{ p_kitchen: "k-1" }]);
  await scan(page);
});

test("S2 alerts already on: the tap only asks the database, it does not subscribe again", async ({ page, context }) => {
  await phone(context, "granted");
  const net = await setup(context, page);
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  await page.goto("/customer/");
  await expect(tell(page)).toBeVisible();
  const before = calls(net, "save_push").length;
  await tell(page).click();
  await expect(page.getByText("We will tell you when it opens.")).toBeVisible();
  expect(calls(net, "save_push").length).toBe(before);
  expect(calls(net, "open_alert_add_v2").length).toBe(1);
});

test("S3 the database says allow alerts first: the line is shown and the button stays", async ({ page, context }) => {
  await phone(context, "granted");
  const net = await setup(context, page);
  net.state.openAlert = { error: "no_push", message: "Allow alerts first." };
  (net.state.kitchens[0] as { open?: boolean }).open = false;
  await page.goto("/customer/");
  await tell(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Allow alerts first." })).toBeVisible();
  await expect(tell(page)).toBeVisible();
});

test("S4 an open kitchen has no such button", async ({ page, context }) => {
  await phone(context, "granted");
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeEnabled();
  await expect(tell(page)).toHaveCount(0);
});
