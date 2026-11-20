// Story 1593 (owner, 16 Nov 2026): "Sign out of this phone" asks once, in a bottom sheet. Story 1692 (owner, 20 Nov 2026): the two buttons are a half and half pair on one line (outline "Stay signed in" left, filled "Sign out" last, right).
// The old box "Forget your details on this phone?" with "Yes, forget" and "No" side by side is gone: one act, one name. Shared cases: Chromium (sign-out-sheet.spec.ts) and WebKit (sign-out-sheet.webkit.spec.ts).
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const you = (page: Page) => page.getByRole("button", { name: /^You: / });
const row = (page: Page) => page.getByRole("button", { name: "Sign out of this phone" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Sign out of this phone?" });
const rect = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x * 2) / 2, y: Math.round(r.y * 2) / 2, w: Math.round(r.width * 2) / 2, h: Math.round(r.height * 2) / 2 }; });

async function open(page: Page, context: Parameters<typeof setup>[0], width = 390, height = 844, tap = true) {
  await setup(context, page, [], { pin: null });
  await page.setViewportSize({ width, height });
  await page.goto("/customer/");
  await page.evaluate(() => localStorage.setItem("gs-pin", "110016"));
  await page.reload();
  await you(page).click();
  if (tap) await row(page).click();
}
const settle = (page: Page) => page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))); });   // the sheet has stopped sliding
const rowBox = (page: Page) => rect(page.locator("button.ui-row", { hasText: "Sign out of this phone" }));   // by class: behind a modal the row has no role
const stillSignedIn = async (page: Page) => { await expect(sheet(page)).toHaveCount(0); expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBe("110016"); };

export function signOutSheet() {
  test("a tap on Sign out of this phone opens a sheet with its one sentence; the old box and its words are gone", async ({ page, context }) => {
    await open(page, context);
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByText("This phone forgets your details. Your orders stay in your account.")).toBeVisible();
    await expect(page.getByText("Forget your details on this phone?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yes, forget" })).toHaveCount(0);
  });

  for (const [w, h] of [[360, 640], [390, 844]]) {
    test(`the two buttons are a half and half pair on one line, Stay signed in left, together as wide as the sheet's content, one line of text each (${w}x${h})`, async ({ page, context }) => {
      await open(page, context, w, h);
      const stay = sheet(page).getByRole("button", { name: "Stay signed in" }), out = sheet(page).getByRole("button", { name: "Sign out", exact: true });
      await settle(page);
      const [a, b, s] = [await rect(stay), await rect(out), await rect(sheet(page))];
      const pad = await sheet(page).evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth), r: parseFloat(c.paddingRight) + parseFloat(c.borderRightWidth) }; });
      const lines = (loc: ReturnType<Page["locator"]>) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });
      expect(a.x).toBeLessThan(b.x);   // Stay signed in is left, Sign out last
      expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.x - (s.x + pad.l))).toBeLessThanOrEqual(1);   // together they fill the sheet's content width
      expect(Math.abs(b.x + b.w - (s.x + s.w - pad.r))).toBeLessThanOrEqual(1);
      for (const l of [await lines(stay), await lines(out)]) expect(l.text).toBeLessThan(1.5 * l.line);   // one line of text each
      expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
    });
  }

  test("the row and the screen behind do not move when the sheet opens", async ({ page, context }) => {
    await open(page, context, 390, 844, false);
    const before = await rowBox(page);
    await row(page).click();
    await expect(sheet(page)).toBeVisible();
    await settle(page);
    expect(await rowBox(page)).toEqual(before);
  });

  test("Stay signed in, Escape, Back and a tap outside close the sheet and sign nobody out", async ({ page, context }) => {
    await open(page, context);
    await sheet(page).getByRole("button", { name: "Stay signed in" }).click();
    await stillSignedIn(page);
    await row(page).click();
    await page.keyboard.press("Escape");
    await stillSignedIn(page);
    await row(page).click();
    await page.goBack();
    await stillSignedIn(page);
    await row(page).click();
    await page.mouse.click(10, 10);
    await stillSignedIn(page);
  });

  test("Sign out wipes what the phone remembers and shows the first screen", async ({ page, context }) => {
    await open(page, context);
    await sheet(page).getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Where does the food go?" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("gs-pin"))).toBeNull();
  });
}
