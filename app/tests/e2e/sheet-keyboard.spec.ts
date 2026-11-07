// Story #954: a bottom sheet follows the visual viewport, so with the iOS keyboard open the sheet keeps its title, the word box and the red button above the keyboard.
// Chromium has no on-screen keyboard, so the visual viewport is emulated: a stand-in window.visualViewport whose height and offsetTop the test sets.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const emulate = async (page: Page) => page.addInitScript(() => {
  const target = new EventTarget();
  const vv = Object.assign(target, { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  (window as unknown as { __vv: (h: number, top: number) => void }).__vv = (h, top) => { vv.height = h; vv.offsetTop = top; target.dispatchEvent(new Event("resize")); target.dispatchEvent(new Event("scroll")); };
});

const fits = async (page: Page, h: number, top: number) => {
  await page.evaluate(([a, b]) => (window as unknown as { __vv: (h: number, t: number) => void }).__vv(a, b), [h, top]);
  const back = page.locator(".ui-sheet-back");
  await expect.poll(async () => Math.round((await back.boundingBox())!.height)).toBe(h);
  expect(Math.round((await back.boundingBox())!.y), "overlay top follows offsetTop").toBe(top);
  const inside = async () => {   // the sheet slides in, so wait for the motion to end
    const o = (await back.boundingBox())!;
    const s = (await page.locator(".ui-sheet-back .ui-sheet").boundingBox())!;
    return s.y >= o.y - 0.5 && s.y + s.height <= o.y + o.height + 0.5;
  };
  await expect.poll(inside, { message: "the sheet sits inside the overlay" }).toBe(true);
  expect(await page.evaluate(() => window.scrollY), "the document does not scroll").toBe(0);
};

test("S1 Remove kitchen: with a 380 px visual viewport the overlay and the sheet follow it", async ({ page, context }) => {
  await emulate(page);
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
  await expect(page.getByRole("dialog", { name: /^Remove / })).toBeVisible();
  await fits(page, 380, 0);
  await fits(page, 380, 40);   // iOS also moves offsetTop when it scrolls the layout viewport
  const full = await page.evaluate(() => window.innerHeight);
  await page.evaluate(() => (window as unknown as { __vv: (h: number, t: number) => void }).__vv(window.innerHeight, 0));
  await expect.poll(async () => Math.round((await page.locator(".ui-sheet-back").boundingBox())!.height)).toBe(full);   // keyboard closed: full screen again
});

test("S2 Clear everything follows the visual viewport too, and its word box and red button stay inside the sheet", async ({ page, context }) => {
  await emulate(page);
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Simulator", exact: true }).click();
  await page.getByRole("button", { name: "Clear everything" }).click();
  await expect(page.getByRole("dialog", { name: "Clear everything?" })).toBeVisible();
  await fits(page, 400, 0);
  const input = page.getByLabel("Type CLEAR to go on");
  await input.focus();
  await expect(input).toBeInViewport();
});

test("S3 the Edit dish sheet follows it as well", async ({ page, context }) => {
  await emulate(page);
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: /^Edit Butter Chicken/ }).click();
  await expect(page.getByRole("dialog", { name: "Edit Butter Chicken" })).toBeVisible();
  await fits(page, 420, 0);
});
