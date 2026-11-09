// Story #1056 (board SW3): the location-off sheet. Shown once per app open over the menu when the phone's location is blocked, or allowed but no position comes in 5 s.
// The auto-picked address stays until the customer chooses. Never shown when location is allowed and a position came, or when it was never asked.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "C-128, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const sheet = (page: Page) => page.getByRole("dialog", { name: "Location is off" });

async function open(page: Page, context: Parameters<typeof setup>[0], perm: "denied" | "granted" | "prompt", pos: "ok" | "never") {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME, WORK];
  await page.addInitScript(([p, w]) => {
    Object.defineProperty(navigator, "permissions", { value: { query: async () => ({ state: p }) }, configurable: true });
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (ok: (x: unknown) => void) => { if (w === "ok") ok({ coords: { latitude: 28.5690, longitude: 77.2440 } }); } }, configurable: true });
  }, [perm, pos] as const);
  await page.clock.install();
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();
  return net;
}

test("S1 location blocked: the sheet shows at once; Turn on location explains the settings; the auto-picked address stays", async ({ page, context }) => {
  await open(page, context, "denied", "never");
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText(/phone settings/)).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Turn on location" }).click();
  await expect(sheet(page).getByText(/phone settings/)).toBeVisible();   // still blocked: the way is explained, no crash
  await sheet(page).getByRole("button", { name: /Work/ }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Work\b/ }).first()).toBeVisible();   // choosing a saved address picks it
});

test("S2 allowed but no position in 5 s: the sheet shows; Search your area opens search", async ({ page, context }) => {
  await open(page, context, "granted", "never");
  await expect(sheet(page)).toHaveCount(0);   // not before the wait is over
  await page.clock.fastForward(5100);
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();   // Home stays behind the sheet
  await sheet(page).getByRole("button", { name: "Search your area" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Deliver to/ })).toBeVisible();
});

test("S3 allowed and a position came: no sheet", async ({ page, context }) => {
  await open(page, context, "granted", "ok");
  await page.clock.fastForward(6000);
  await expect(sheet(page)).toHaveCount(0);
});

test("S4 never asked (prompt): no sheet, nothing is asked on open", async ({ page, context }) => {
  await open(page, context, "prompt", "never");
  await page.clock.fastForward(6000);
  await expect(sheet(page)).toHaveCount(0);
});
