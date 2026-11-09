// Story #1103 (board O0g-B-GoogleFirst, cases 1.2 to 1.4): the welcome screen shows the thali picture between the title and Continue with Google.
// The picture is 306 x 181, centred, with alt text, served at 1x and 2x; the button sits right under it and is whole on a small phone (375 x 667).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the thali picture sits between the title and the button, 306 x 181, centred, with alt text", async ({ page, context }) => {
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  const title = page.getByRole("heading", { name: "One tap and you are in" });
  const pic = page.getByRole("img", { name: /thali/i });
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(pic).toBeVisible();
  await expect.poll(() => pic.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);   // the file is served, not a broken icon
  const [t, p, b] = [await title.boundingBox(), await pic.boundingBox(), await button.boundingBox()];
  expect([Math.round(p!.width), Math.round(p!.height)]).toEqual([306, 181]);
  expect(p!.y).toBeGreaterThan(t!.y + t!.height - 1);   // under the title
  expect(b!.y).toBeGreaterThan(p!.y + p!.height - 1);   // above the button
  expect(Math.abs(p!.x + p!.width / 2 - (b!.x + b!.width / 2))).toBeLessThan(1.5);   // centred on the button, which is the slip's width
  expect(await pic.getAttribute("srcset")).toContain("@2x.png 2x");
});

test("S2 on a small phone (375 x 667) the whole button is visible without scrolling", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  const b = await page.getByRole("button", { name: "Continue with Google" }).boundingBox();
  expect(b!.y + b!.height).toBeLessThanOrEqual(667);
});

test("S3 the picture top is 157 px under the slip top, as on the board", async ({ page, context }) => {
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  const slip = await page.locator(".ui-slip").first().boundingBox();
  const p = await page.getByRole("img", { name: /thali/i }).boundingBox();
  expect(Math.abs(p!.y - slip!.y - 157)).toBeLessThanOrEqual(2);
});
