// Story #801: Google comes back to the screen the tap came from. The welcome screen asks for the menu, You asks for You.
// Google itself is never reached: the authorize request is refused by the test. The page leaves for Google, so the screen's own memory
// (sessionStorage gs-return) is recorded the moment it is written, not read afterwards.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

async function watchReturn(context: BrowserContext, page: Page) {
  const written: string[] = [];
  await page.exposeFunction("__gsReturn", (v: string) => written.push(v));
  await context.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === "gs-return") (window as unknown as { __gsReturn: (v: string) => void }).__gsReturn(v);
      return set.call(this, k, v);
    };
  });
  await context.route(/authorize/, (route) => route.abort());
  return written;
}

test("S1 a tap on Google on the welcome screen comes back to the menu", async ({ page, context }) => {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  const written = await watchReturn(context, page);
  await page.goto("/customer/");
  await page.getByTestId("google-signin").click();
  await expect.poll(() => written).toEqual(["menu"]);
});

test("S2 a tap on Google on You comes back to You", async ({ page, context }) => {
  await setup(context, page);
  const written = await watchReturn(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByTestId("google-signin").click();
  await expect.poll(() => written).toEqual(["account"]);
});
