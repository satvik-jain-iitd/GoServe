// Regression, screen 31: Y4b You, alerts, Edit, Night. Cases: .claude/handoff/qa/screens/31-You.md (epic #1196, story #1197). Reached with the shared step STEPS["account"].
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

// A phone whose order-alerts permission the test sets (installed before the shared step runs).
async function phone(context: BrowserContext, permission: "default" | "granted" | "denied") {
  await context.addInitScript((perm) => {
    const w = window as unknown as { Notification: any };
    if (typeof w.Notification === "undefined") w.Notification = function () {};
    Object.defineProperty(w.Notification, "permission", { get: () => perm, configurable: true });
  }, permission);
}

// Records what the app wipes from this phone's storage (the sheet clears it and reloads). The record lives in sessionStorage, which survives the reload.
async function recordWipe(page: Page) {
  await page.evaluate(() => {
    const clear = Storage.prototype.clear;
    Storage.prototype.clear = function () {
      try { window.sessionStorage.setItem("gs-test-wiped", JSON.stringify(Object.keys(window.localStorage))); } catch { /* blocked */ }
      return clear.call(this);
    };
  });
}
const wiped = (page: Page) => page.evaluate(() => window.sessionStorage.getItem("gs-test-wiped"));

// Parses "rgb(r, g, b)" or "rgba(r, g, b, a)" into numbers.
const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
const isDark = (c: string) => Math.max(...rgb(c)) < 128;

const card = (page: Page) => page.getByRole("region", { name: "Delivery details" });

test("TC 31.1 Look: Back, You, the lime name card with Edit, the cards in order, the red Sign out and Delete at the bottom", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You", exact: true, level: 1 })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Edit delivery details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved addresses" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Your orders" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Order alerts" })).toBeVisible();
  const look = page.getByRole("region", { name: "Look" });
  await expect(look.getByRole("button", { name: "Day" })).toBeVisible();
  await expect(look.getByRole("button", { name: "Night" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send feedback" })).toBeVisible();
  const sign = page.getByRole("button", { name: "Sign out of this phone" });
  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(sign).toBeVisible();
  await expect(del).toBeVisible();
  // The order from the case: name card, saved and orders, alerts and look, feedback, then the two risky rows.
  const y = async (loc: typeof sign) => (await loc.boundingBox())!.y;
  expect(await y(card(page).getByRole("button", { name: "Edit delivery details" }))).toBeLessThan(await y(page.getByRole("button", { name: "Saved addresses" })));
  expect(await y(page.getByRole("button", { name: "Your orders" }))).toBeLessThan(await y(page.getByRole("switch", { name: "Order alerts" })));
  expect(await y(page.getByRole("switch", { name: "Order alerts" }))).toBeLessThan(await y(page.getByRole("button", { name: "Send feedback" })));
  expect(await y(page.getByRole("button", { name: "Send feedback" }))).toBeLessThan(await y(sign));
  expect(await y(sign)).toBeLessThan(await y(del));
  // The two risky rows are in the error colour (the red of the day theme).
  const red = await sign.evaluate((e) => getComputedStyle(e.querySelector("span") ?? e).color);
  const [r, g] = rgb(red);
  expect(r, `sign-out colour ${red}`).toBeGreaterThan(g + 80);
});

test("TC 31.2 Order alerts: allowed shows On with a green switch, not asked shows it off, blocked says so and locks the switch", async ({ page, context, browser }) => {
  // Allowed, in this context.
  await phone(context, "granted");
  await STEPS["account"](context, page, PATH);
  const sw = page.getByRole("switch", { name: "Order alerts" });
  await expect(page.getByText("On for this phone")).toBeVisible();
  await expect(sw).toBeChecked();
  const paint = await sw.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, knob: getComputedStyle(el, "::before").backgroundColor }));
  const [r, g, b] = rgb(paint.bg);
  expect(g, `switch colour ${paint.bg}`).toBeGreaterThan(r);
  expect(g, `switch colour ${paint.bg}`).toBeGreaterThan(b);
  expect(paint.knob).toBe("rgb(255, 255, 255)");
  await context.close();

  // Not asked yet: the switch is off, no On line and no Blocked line.
  const askCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const askPage = await askCtx.newPage();
  await phone(askCtx, "default");
  await STEPS["account"](askCtx, askPage, PATH);
  await expect(askPage.getByRole("switch", { name: "Order alerts" })).toBeVisible();   // proves the card shows before the absence is checked
  await expect(askPage.getByRole("switch", { name: "Order alerts" })).not.toBeChecked();
  await expect(askPage.getByText("On for this phone")).toHaveCount(0);
  await expect(askPage.getByText(/^Blocked in your phone settings/)).toHaveCount(0);
  await askCtx.close();

  // Blocked: the exact line, the switch locked off.
  const blockedCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const blockedPage = await blockedCtx.newPage();
  await phone(blockedCtx, "denied");
  await STEPS["account"](blockedCtx, blockedPage, PATH);
  await expect(blockedPage.getByText("Blocked in your phone settings. Settings › Notifications › GoServe, then come back.")).toBeVisible();
  await expect(blockedPage.getByRole("switch", { name: "Order alerts" })).not.toBeChecked();
  await expect(blockedPage.getByRole("switch", { name: "Order alerts" })).toBeDisabled();
  await blockedCtx.close();
});

test("TC 31.3 Night: the whole page is night, the page background and the cards", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  await expect(page.getByRole("region", { name: "Look" }).getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true");   // Day shows first
  const pageBg = page.getByRole("dialog", { name: "You" });
  // A white card of the page: the one that holds Send feedback (the name card is lime in both themes).
  const whiteCard = page.getByRole("button", { name: "Send feedback" }).locator("xpath=..");
  await page.getByRole("region", { name: "Look" }).getByRole("button", { name: "Night" }).click();
  await expect(page.getByRole("region", { name: "Look" }).getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Sign out of this phone" })).toBeVisible();   // the page is live after the tap
  expect(isDark(await pageBg.evaluate((e) => getComputedStyle(e).backgroundColor)), "page background in Night").toBe(true);
  expect(isDark(await whiteCard.evaluate((e) => getComputedStyle(e).backgroundColor)), "card in Night").toBe(true);
});

test("TC 31.4 Edit, type a name, Save: the card shows the name, the fields have an example", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  await card(page).getByRole("button", { name: "Edit delivery details" }).click();
  const name = page.getByLabel("Your name");
  await expect(name).toBeVisible();   // proves the form opened
  await name.fill("Asha Test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(name).toHaveCount(0);
  await expect(card(page).getByRole("heading", { name: "Asha Test" })).toBeVisible();
  // The case wants an example in the fields: open Edit again and look for it.
  await card(page).getByRole("button", { name: "Edit delivery details" }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();
  test.fail(true, "#1244: the Edit fields show no e.g. example: Your name, Phone and Address have no placeholder");
  await expect(page.getByLabel("Your name")).toHaveAttribute("placeholder", /e\.g\./);
});

test("TC 31.5 Send feedback: the Feedback sheet opens", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "You" })).toHaveCount(0);
});

test("TC 31.6 Sign out of this phone: confirm first, then the phone's data is wiped", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  await recordWipe(page);
  await page.getByRole("button", { name: "Sign out of this phone" }).click();
  await expect(page.getByText("Forget your details on this phone?")).toBeVisible();   // the confirm shows before anything goes
  await page.getByRole("button", { name: "Yes, forget" }).click();
  await expect(page.getByRole("dialog", { name: "You" })).toHaveCount(0);   // the page reloads: the You screen is gone
  await expect.poll(() => wiped(page)).not.toBeNull();   // the app cleared this phone's storage
  expect(JSON.parse((await wiped(page)) ?? "[]")).toContain("gs-pin");
});

test("TC 31.7 Delete my account: the confirm names what goes, then Account deleted and the phone's data is wiped", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  await recordWipe(page);
  await page.getByRole("button", { name: "Delete my account" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Your orders, saved details and Google link are deleted. This cannot be undone.")).toBeVisible();
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Account deleted" })).toBeVisible();
  await expect.poll(() => wiped(page)).not.toBeNull();   // the app cleared this phone's storage
  expect(JSON.parse((await wiped(page)) ?? "[]")).toContain("gs-pin");
});

test("TC 31.8 signed in with Google: one sign-out only, the Google name and photo in the card", async ({ page, context }) => {
  await STEPS["account"](context, page, PATH);
  // The shared step signs in by phone code; this test signs the same account in with Google (a name and a photo) and opens You again.
  const photo = "https://photos.example.test/asha.gif";   // the app shows only https photos
  await context.route("https://photos.example.test/**", (route) => route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64") }));
  await context.route("https://test.supabase.co/auth/v1/user", (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ id: "7e57ab1e-0000-4000-8000-0000000000a1", aud: "authenticated", role: "authenticated", is_anonymous: false, app_metadata: {}, email: "asha@example.test", user_metadata: { full_name: "Amit Kumar", avatar_url: photo }, created_at: "2026-11-01T10:00:00Z" }) });
  });
  await page.reload();
  await page.getByRole("button", { name: "Account" }).click();
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByRole("heading", { name: "Amit", exact: true })).toBeVisible();   // proves the Google first name shows
  await expect(card(page).locator("img")).toHaveCount(1);   // the Google photo
  test.fail(true, "#1245: two sign-outs on You: the Google row has its own Sign out next to Sign out of this phone");
  await expect(page.getByRole("button", { name: /^Sign out/ })).toHaveCount(1);
});
