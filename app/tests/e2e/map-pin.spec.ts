// Story #933: nothing of the map shows through the Remove sheet. (Story 1052: the kitchen form has no inline map any more, so the tests of its pin and focus rectangle went with it; the shared map is tested in pin-map.spec.)
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const KITCHEN = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };

test("S3 with the Remove sheet open the map sits under the standard half-dim backdrop, never above it", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true; net.state.kitchens = [KITCHEN];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
  await expect(page.getByRole("dialog", { name: "Remove Tau Ka Dhaba?" })).toBeVisible();
  const back = page.locator(".ui-sheet-back");
  expect(await back.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(38, 53, 40, 0.5)");   // the standard half-dim backdrop, like every other sheet: the page stays behind it
  // the point at the centre of the map, and the point of its zoom buttons, must both land on the backdrop (or the sheet in it), never on a map tile or control
  const at = await page.evaluate(() => {
    const hit = (sel: string) => { const el = document.querySelector(sel); if (!el) return "none"; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20)); return top?.closest(".ui-sheet-back") ? "backdrop" : "map"; };
    return [hit(".ui-map-box"), hit(".leaflet-control-zoom")];
  });
  expect(at.every((x) => x === "backdrop" || x === "none"), `top element over the map: ${at}`).toBe(true);
});
