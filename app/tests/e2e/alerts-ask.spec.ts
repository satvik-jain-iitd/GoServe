// Story #1049 part 2 (board N0): first open, after the number, order alerts are asked once, before the location. Turn on asks the phone's permission and moves on either way;
// Not now moves on without asking. Where alerts are blocked or the phone has none, the step is not shown.
import { test, expect, type BrowserContext } from "@playwright/test";
import { setup } from "./helpers";

async function phone(context: BrowserContext, permission: "default" | "denied" | "granted", answer: "granted" | "denied" = "denied") {
  await context.addInitScript(([perm, ans]) => {
    Object.defineProperty(Notification, "permission", { get: () => perm, configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => { (window as unknown as { __asked: number }).__asked = ((window as unknown as { __asked?: number }).__asked ?? 0) + 1; return ans; };
  }, [permission, answer]);
}
const step2 = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "Order alerts" });
const asked = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0);

test("S1 first open shows Order alerts as step 2 of 4 before the location ask", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await phone(context, "default");
  await page.goto("/customer/");
  await expect(step2(page)).toBeVisible();
  await expect(step2(page)).toContainText("Step 2 of 4");
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set delivery location" })).toHaveCount(0);
  expect(await asked(page)).toBe(0);   // nothing is asked until the tap
});

test("S2 Turn on alerts asks the permission and moves on to the location, even when the phone says no; it is never asked again", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await phone(context, "default", "denied");
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Turn on alerts" }).click();
  await expect(page.getByRole("button", { name: "Set delivery location" })).toBeVisible();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  expect(await asked(page)).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Set delivery location" })).toBeVisible();
  await expect(step2(page)).toHaveCount(0);
});

test("S3 Not now moves on without asking the phone", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await phone(context, "default");
  await page.goto("/customer/");
  await page.getByRole("button", { name: "I'll check the app myself" }).click();
  await expect(page.getByRole("button", { name: "Set delivery location" })).toBeVisible();
  expect(await asked(page)).toBe(0);
});

test("S4 alerts blocked in the phone settings: the step is not shown", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await phone(context, "denied");
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Set delivery location" })).toBeVisible();
  await expect(step2(page)).toHaveCount(0);
});

// Story #1116 (TC 2.1): Turn on alerts always moves on. When the phone's permission call never settles (iPhone Safari outside the home-screen app), the screen waits about 8 seconds and goes to step 3.
test("TC 2.1 Turn on alerts always moves on, even when the phone never answers (#1116)", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    (Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = () => new Promise(() => undefined);   // never settles
  });
  await page.clock.install();
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Turn on alerts" }).click();
  await expect(step2(page)).toBeVisible();   // still waiting
  await page.clock.fastForward(8_500);
  await expect(page.getByRole("button", { name: "Set delivery location" })).toBeVisible();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
});
