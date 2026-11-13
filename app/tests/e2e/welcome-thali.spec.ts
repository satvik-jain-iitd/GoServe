// Stories 1371 to 1374 (board O0g-F-WelcomeChipG, row 2ao): the welcome screen. Title "Sign in to start" with the line "Then: order alerts and your address.",
// a thali with no box that sets itself (the plate turns in, the dishes pop in one by one, steam rises; a 6 s loop), the Terms and Privacy line,
// and our green button with the standard Google G on a white 32 px chip. Reduced motion: the thali stands still, whole.
// Before: story 1103 (board O0g-B) put a boxed thali picture, 306 x 181, under "Sign in to start".
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { setup } from "./helpers";

const open = async (context: BrowserContext, page: Page) => { await setup(context, page, [], { guest: true }); await page.goto("/customer/"); };
const thali = (page: Page) => page.locator(".ui-thali");
const WHITE = ["rgb", "(255, 255, 255)"].join("");   // Google: the G sits on white
const button = (page: Page) => page.getByRole("button", { name: "Continue with Google" });

test("S1 the title is Sign in to start, with the line Then: order alerts and your address. under it, centred", async ({ page, context }) => {
  await open(context, page);
  const title = page.getByRole("heading", { name: "Sign in to start" });
  await expect(title).toBeVisible();
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toHaveCount(0);
  const sub = page.getByText("Then: order alerts and your address.", { exact: true });
  await expect(sub).toBeVisible();
  const s = await sub.evaluate((e) => { const c = getComputedStyle(e); return { size: c.fontSize, align: c.textAlign }; });
  expect(s).toEqual({ size: "14px", align: "center" });
  const [t, b] = [await title.boundingBox(), await sub.boundingBox()];
  expect(b!.y).toBeGreaterThan(t!.y + t!.height - 1);
  expect(b!.y - (t!.y + t!.height)).toBeLessThanOrEqual(10);   // the board: 16 px gap less 8
  await expect(page.getByText(/Step \d of \d/)).toHaveCount(0);   // story 1404: no step count, though the board still shows one
});

test("S2 the line By continuing you agree to our Terms and Privacy sits right above the button, with real links", async ({ page, context }) => {
  await open(context, page);
  const line = page.getByText("By continuing you agree to our", { exact: false });
  await expect(line).toHaveText("By continuing you agree to our Terms and Privacy");
  await expect(line.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms/");
  await expect(line.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
  expect(await line.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  const [l, b] = [await line.boundingBox(), await button(page).boundingBox()];
  expect(b!.y).toBeGreaterThan(l!.y + l!.height - 1);
  expect(b!.y - (l!.y + l!.height)).toBeLessThanOrEqual(20);
});

test("S3 the button carries the standard colour G on a white 32 px round chip, hidden from screen readers; the button keeps its name", async ({ page, context }) => {
  await open(context, page);
  await expect(button(page)).toHaveText("Continue with Google");
  const chip = button(page).locator(".ui-g-chip");
  const c = await chip.evaluate((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, bg: s.backgroundColor, round: s.borderTopLeftRadius, hidden: e.getAttribute("aria-hidden") }; });
  expect(c).toEqual({ w: 32, h: 32, bg: WHITE, round: "999px", hidden: "true" });
  const g = chip.locator("img");
  await expect(g).toHaveAttribute("src", "/brand/google-g.svg");   // Google's rule: the standard colour G, never recoloured
  await expect.poll(() => g.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  expect((await g.boundingBox())!.width).toBe(20);
  const [cb, t] = [await chip.boundingBox(), await button(page).getByText("Continue with Google").boundingBox()];
  expect(Math.round(t!.x - (cb!.x + cb!.width))).toBe(12);
});

test("S4 the thali is seven layers, 210 px wide, centred, one picture name; with motion the plate turns in and each dish pops in later than the one before", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });   // the board's size: the thali top is 123 px under the slip top
  await open(context, page);
  await expect(thali(page)).toBeVisible();
  const imgs = thali(page).locator("img");
  await expect(imgs).toHaveCount(7);
  await expect(page.getByRole("img", { name: "A thali from our kitchen" })).toHaveCount(1);
  for (const i of await imgs.all()) await expect.poll(() => i.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  const box = (await thali(page).boundingBox())!;
  expect(Math.round(box.width)).toBe(210);
  const slip = (await page.locator(".ui-slip").first().boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (slip.x + slip.width / 2))).toBeLessThan(1.5);
  expect(Math.abs(box.y - slip.y - 123)).toBeLessThanOrEqual(2);
  const anim = await imgs.evaluateAll((es) => es.map((e) => { const s = getComputedStyle(e); return { name: s.animationName, time: s.animationDuration, loop: s.animationIterationCount }; }));
  expect(anim.map((a) => a.name)).toEqual(["gs-th-plate", "gs-th-rotis", "gs-th-rice", "gs-th-dal", "gs-th-paneer", "gs-th-raita", "gs-th-salad"]);
  expect(new Set(anim.map((a) => `${a.time} ${a.loop}`))).toEqual(new Set(["6s infinite"]));
  expect(await thali(page).locator("svg.steam path").count()).toBe(3);
});

test("S5 reduced motion: the thali stands still and whole, nothing moves", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(context, page);
  await expect(thali(page)).toBeVisible();
  const s = await thali(page).locator("img, svg").evaluateAll((es) => es.map((e) => { const c = getComputedStyle(e); return `${c.animationName} ${c.opacity}`; }));
  expect(new Set(s)).toEqual(new Set(["none 1"]));
});

test("S6 on a small phone (360 x 640) nothing scrolls, the thali sits clear above the Terms line, and the whole button shows", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await open(context, page);
  await expect(button(page)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.locator(".ui-welcome").evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0);
  const b = (await button(page).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(640);
  const [th, line] = [await thali(page).boundingBox(), await page.getByText("By continuing you agree to our", { exact: false }).boundingBox()];
  expect(th!.y + th!.height).toBeLessThanOrEqual(line!.y);
});

// Review of PR 1463: at 320 x 568 the words wrapped to two lines ("Continue with" / "Google").
test("S7 at 320 x 568 the button words stay on one line, next to the G chip", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(context, page);
  const words = button(page).getByText("Continue with Google", { exact: true });
  const lh = await words.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.45);
  expect((await words.boundingBox())!.height).toBeLessThan(lh * 1.5);
  const [b, w] = [await button(page).boundingBox(), await words.boundingBox()];
  expect(w!.x + w!.width).toBeLessThanOrEqual(b!.x + b!.width);   // inside the button
  expect(await button(page).evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
});
