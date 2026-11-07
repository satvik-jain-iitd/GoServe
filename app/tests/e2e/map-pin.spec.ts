// Story #933: the kitchen's marker on the admin map is a pin (not the K circle), the map draws no focus rectangle, and nothing of it shows through the Remove sheet.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const KITCHEN = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };

const addForm = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /Add a kitchen|\+ Add kitchen/ }).first().click();
  await expect(page.getByLabel("Kitchen name")).toBeVisible();
};

test("S1 a tap on the map puts a pin there: one inline SVG, 24 by 32, not the K circle", async ({ page, context }) => {
  await addForm(page, context);
  await page.locator(".ui-map-box").click({ position: { x: 150, y: 110 } });
  const icon = page.locator(".leaflet-marker-icon");
  await expect(icon).toHaveCount(1);
  const svg = icon.locator("svg");
  await expect(svg).toHaveCount(1);
  expect(await svg.evaluate((e) => [e.getAttribute("width"), e.getAttribute("height")])).toEqual(["24", "32"]);
  await expect(icon).not.toContainText("K");
  // the tip of the pin is the location: the icon box is anchored at its bottom centre
  const [w, h, ml, mt] = await icon.evaluate((e) => { const s = getComputedStyle(e); return [parseFloat(s.width), parseFloat(s.height), parseFloat(s.marginLeft), parseFloat(s.marginTop)]; });
  expect([w, h, ml, mt]).toEqual([24, 32, -12, -32]);
});

test("S2 the map is not a keyboard stop: no tabindex, so a tap leaves no focus rectangle", async ({ page, context }) => {
  await addForm(page, context);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(await page.locator(".leaflet-container").getAttribute("tabindex")).toBeNull();
  await page.locator(".ui-map-box").click({ position: { x: 100, y: 100 } });
  expect(await page.locator(".leaflet-container").evaluate((e) => getComputedStyle(e).outlineStyle)).toBe("none");
});

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
