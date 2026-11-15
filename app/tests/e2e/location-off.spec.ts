// Story #1056 (board SW3), changed by stories 1529 and 1526 (board LO-V1): the sheet "Where to bring your food?". Shown once per app open over the menu when the phone
// is not found: blocked, allowed but no position in 5 s, or never asked. The place stays until the customer chooses. Never shown when a position came. More cases: location-sheet.spec.ts.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "Z-900, Green Avenue Colony, Chhatarpur", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const WORK = { id: "w1", label: "Work", address: "Tower B, Sector 62, Noida", pin_code: "110016", lat: 28.6208, lng: 77.3639, last_used_at: "2026-11-01T10:00:00Z" };
const sheet = (page: Page) => page.getByRole("dialog", { name: "Where to bring your food?" });

async function open(page: Page, context: Parameters<typeof setup>[0], perm: "denied" | "granted" | "prompt", pos: "ok" | "never", wait = true) {
  const net = await setup(context, page, [], { pin: null });   // a new phone: the address used last is taken
  net.state.addresses = [HOME, WORK];
  await page.addInitScript(([p, w]) => {
    Object.defineProperty(navigator, "permissions", { value: { query: async () => ({ state: p }) }, configurable: true });
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (ok: (x: unknown) => void, bad: (x: unknown) => void) => { (window as unknown as { __asked?: number }).__asked = ((window as unknown as { __asked?: number }).__asked ?? 0) + 1; if (w === "ok") ok({ coords: { latitude: 28.5690, longitude: 77.2440 } }); else if (p === "denied") bad({ code: 1 }); } }, configurable: true });
  }, [perm, pos] as const);
  await page.clock.install();
  await page.goto("/customer/");
  if (wait) await expect(page.getByRole("button", { name: /^Home\b/ }).first()).toBeVisible();
  return net;
}

test("S1 location blocked: the sheet shows at once; Try location again explains the settings; the auto-picked address stays", async ({ page, context }) => {
  await open(page, context, "denied", "never");
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText(/Turn on location in your phone's settings/)).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Try location again" }).click();
  await expect(sheet(page).getByText(/Turn on location in your phone's settings/)).toBeVisible();   // still blocked: the way is explained, no crash
  await sheet(page).getByRole("button", { name: /Work/ }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Work\b/ }).first()).toBeVisible();   // choosing a saved address picks it
});

test("S2 allowed but no position in 5 s: the sheet shows; Search your area opens search", async ({ page, context }) => {
  await open(page, context, "granted", "never", false);   // a new phone takes its place when the find is over
  await expect(page.getByRole("heading", { name: "Where does the food go?" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0)).toBe(1);   // the find has started
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

test("S4 never asked (prompt): the sheet shows, and nothing is asked on open (the ask comes on the tap)", async ({ page, context }) => {
  await open(page, context, "prompt", "never");
  await page.clock.fastForward(6000);
  await expect(sheet(page)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __asked?: number }).__asked ?? 0)).toBe(0);
});
