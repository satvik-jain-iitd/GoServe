// Story #1112 (TC 1.6): a returning customer never sees the alerts ask (N0). Signed in, no pin on this phone yet, the saved addresses still on their way:
// that is loading, not "needs an area". N0 is only for a first open: signed in, no saved address, no pin.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "C-128, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };

test("TC 1.6 returning customer never sees N0 while the saved addresses load (#1112)", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = [HOME];
  await context.addInitScript(() => { Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true }); });   // alerts not decided yet: N0 would show
  await context.route("**/rest/v1/addresses**", async (route) => { await new Promise((r) => setTimeout(r, 1800)); await route.fallback(); });   // the read is slow
  const seen: boolean[] = [];
  await page.exposeFunction("sawN0", () => seen.push(true));
  await page.addInitScript(() => {
    new MutationObserver(() => { if (document.body.innerText.includes("Get order alerts")) (window as unknown as { sawN0: () => void }).sawN0(); }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible({ timeout: 15_000 });   // the menu, with the last address
  expect(seen, "N0 flashed for a returning customer").toEqual([]);
});

test("TC 1.6b a first open (no saved address, no pin) still gets N0", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await context.addInitScript(() => { Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true }); });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Get order alerts" })).toBeVisible();
});
