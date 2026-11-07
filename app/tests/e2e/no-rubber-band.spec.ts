// Story #932, second part: the document can never move, so a drag that starts on the tab bar cannot lift the bar and the page off the bottom edge on an iPhone.
// Only inner boxes scroll. The welcome screen, which used to scroll the document, scrolls inside its own box.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 html and body never scroll or rubber-band", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  const s = await page.evaluate(() => [document.documentElement, document.body].map((e) => { const c = getComputedStyle(e); return { y: c.overflowY, over: c.overscrollBehaviorY }; }));
  expect(s).toEqual([{ y: "hidden", over: "none" }, { y: "hidden", over: "none" }]);
});

test("S2 a drag that starts on the tab bar is not a pan (touch-action none)", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "History" })).toBeVisible();
  expect(await page.locator(".ui-tabs").evaluate((e) => getComputedStyle(e).touchAction)).toBe("none");
});

test("S3 on a short phone the document does not move; the list scrolls inside its own box", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  const doc = await page.evaluate(() => { window.scrollTo(0, 400); return { y: window.scrollY, fits: document.documentElement.scrollHeight <= document.documentElement.clientHeight }; });
  expect(doc).toEqual({ y: 0, fits: true });
  const tabs = page.getByRole("button", { name: "History" });
  const before = await tabs.boundingBox();
  await page.mouse.wheel(0, 3000);
  expect((await tabs.boundingBox())!.y).toBe(before!.y);
});

test("S4 the welcome screen on a short phone scrolls inside its own box, so its Google button can still be reached", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await setup(context, page, [], { guest: true });
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  const welcome = page.locator(".ui-welcome");
  await expect(welcome).toBeVisible();
  expect(await welcome.evaluate((e) => ({ over: getComputedStyle(e).overflowY, scrolls: e.scrollHeight > e.clientHeight }))).toEqual({ over: "auto", scrolls: true });
  await welcome.evaluate((e) => e.scrollTo(0, e.scrollHeight));
  await expect(page.getByTestId("google-signin")).toBeInViewport();
});

test("S5 the demo console and the ops page, which are not framed phone screens, scroll inside their own box", async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 500 });
  await setup(context, page);
  for (const path of ["/console/", "/ops/"]) {
    await page.goto(path);
    const shell = page.locator(".shell").first();
    await expect(shell).toBeVisible();
    const r = await shell.evaluate((e) => ({ over: getComputedStyle(e).overflowY, h: Math.round(e.getBoundingClientRect().height) }));
    expect(r, path).toEqual({ over: "auto", h: 500 });
  }
});
