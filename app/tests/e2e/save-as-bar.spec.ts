// Story 1422 (board NC2-SheetNoCount, owner 13 Nov 2026): on the Address details sheet "Save as" is the joined bar (design system N7), not three pills.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";

const toSheet = async (page: Page, context: Parameters<(typeof STEPS)["first-open-pin"]>[0]) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
};
const bar = (page: Page) => page.getByRole("group", { name: "Save as" });

test("B1 the sheet shows one group Save as with three buttons in one row, each the same width, no gap between them", async ({ page, context }) => {
  await toSheet(page, context);
  const parts = bar(page).getByRole("button");
  await expect(parts).toHaveText(["Home", "Office", "Other"]);
  const boxes = await Promise.all([0, 1, 2].map(async (i) => (await parts.nth(i).boundingBox())!));
  for (const b of boxes) { expect(Math.abs(b.y - boxes[0].y)).toBeLessThanOrEqual(0.5); expect(Math.abs(b.width - boxes[0].width)).toBeLessThanOrEqual(1); }
  expect(Math.abs(boxes[1].x - (boxes[0].x + boxes[0].width))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(boxes[2].x - (boxes[1].x + boxes[1].width))).toBeLessThanOrEqual(1.5);
});

test("B2 Home is chosen at first; a tap on Office moves the fill", async ({ page, context }) => {
  await toSheet(page, context);
  await expect(bar(page).getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true");
  await bar(page).getByRole("button", { name: "Office" }).click();
  await expect(bar(page).getByRole("button", { name: "Office" })).toHaveAttribute("aria-pressed", "true");
  await expect(bar(page).getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "false");
});

test("B3 Other shows Name this place", async ({ page, context }) => {
  await toSheet(page, context);
  await expect(page.getByLabel("Name this place")).toHaveCount(0);
  await bar(page).getByRole("button", { name: "Other" }).click();
  await expect(page.getByLabel("Name this place")).toBeVisible();
});

test("B4 measured in the browser: 44 px high, and the chosen fill is the lime-soft token with on-tertiary 14 px 600 text, like the other lime-soft surfaces", async ({ page, context }) => {
  await toSheet(page, context);
  const home = bar(page).getByRole("button", { name: "Home" });
  expect(Math.round((await bar(page).boundingBox())!.height)).toBe(44);
  const got = await home.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.background = "var(--gs-lime-soft)"; probe.style.color = "var(--md-on-tertiary)";
    document.body.appendChild(probe);
    const want = getComputedStyle(probe); const c = getComputedStyle(el);
    const r = { fill: c.backgroundColor === want.backgroundColor, ink: c.color === want.color, size: c.fontSize, weight: c.fontWeight };
    probe.remove();
    return r;
  });
  expect(got).toEqual({ fill: true, ink: true, size: "14px", weight: "600" });
});

test("B5 at 360 x 640 Save address is in view with no scroll, and the pin and Back are not covered", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await toSheet(page, context);
  const sheet = page.getByRole("dialog", { name: "Address details" });
  const save = (await page.getByRole("button", { name: "Save address" }).boundingBox())!;
  expect(save.y + save.height).toBeLessThanOrEqual(640);
  expect(await sheet.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  const top = (await sheet.boundingBox())!.y;
  const back = (await page.getByRole("button", { name: "Back" }).first().boundingBox())!;
  expect(back.y + back.height).toBeLessThanOrEqual(top);
  const pin = (await page.locator(".ui-pinmap-pin").first().boundingBox())!;
  expect(pin.y + pin.height).toBeLessThanOrEqual(top);
});

test("B6 (review of PR 1427, board NC2) the bar's lines are the fields' border colour; 6 px under the label and 16 px above it, like the fields", async ({ page, context }) => {
  await toSheet(page, context);
  const field = page.getByLabel("Landmark (optional)");
  const line = (el: Element) => getComputedStyle(el).borderTopColor;
  const want = await field.evaluate(line);
  expect(await bar(page).evaluate(line)).toBe(want);
  expect(await bar(page).getByRole("button", { name: "Office" }).evaluate((el) => getComputedStyle(el).borderLeftColor)).toBe(want);
  const label = (await page.locator(".ui-pinmap-saveas > .ui-pinmap-kicker").boundingBox())!;
  const b = (await bar(page).boundingBox())!;
  const f = (await field.boundingBox())!;
  expect(Math.round(b.y - (label.y + label.height))).toBe(6);
  expect(Math.round(label.y - (f.y + f.height))).toBe(16);
});

// Review of PR 1427: Night contrast on the chosen part, and the keyboard ring is not clipped by the bar.
const rgb = (css: string) => { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d")!; x.fillStyle = css; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); };
for (const theme of ["day", "night"] as const) {
  test(`B7 ${theme}: the chosen part's text is 4.5:1 or more on its fill`, async ({ page, context }) => {
    await toSheet(page, context);
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const ratio = await bar(page).getByRole("button", { name: "Home" }).evaluate((el, src) => {
      const toRgb = new Function(`return (${src})`)() as (c: string) => number[];
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const s = getComputedStyle(el); const a = lum(toRgb(s.color)), b = lum(toRgb(s.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, rgb.toString());
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

test("B8 a keyboard focus ring on a bar part sits inside the part (the bar clips what is outside)", async ({ page, context }) => {
  await toSheet(page, context);
  const office = bar(page).getByRole("button", { name: "Office" });
  await office.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(office).toBeFocused();
  const ring = await office.evaluate((el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset) }; });
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThan(0);
  expect(ring.offset + ring.width).toBeLessThanOrEqual(0);
});

// Story 1428: every field on the sheet has the same edge, Day and Night. Name this place had the paler outline-variant edge.
for (const t of ["day", "night"] as const) {
  test(`B-1428 in ${t}, Name this place has the same border as Landmark, keeps 45 px and its focus border`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), t);
    await toSheet(page, context);
    await bar(page).getByRole("button", { name: "Other" }).click();
    const edge = (label: string) => page.getByLabel(label).evaluate((e) => getComputedStyle(e).borderTopColor);
    expect(await edge("Name this place")).toBe(await edge("Landmark (optional)"));
    expect(Math.round((await page.getByLabel("Name this place").boundingBox())!.height)).toBe(45);
    await page.getByLabel("Landmark (optional)").focus();
    const landmarkFocus = await edge("Landmark (optional)");
    await page.getByLabel("Name this place").focus();
    expect(await edge("Name this place")).toBe(landmarkFocus);
  });
}

// Story 1430: at Night the keyboard ring on the chosen part (lime-soft) was the lime primary, almost not seen. It must be 3:1 or more on the fill; Day and the other parts stay as they are.
for (const theme of ["day", "night"] as const) {
  test(`B-1430 ${theme}: the keyboard ring on the chosen part is 3:1 or more on its fill`, async ({ page, context }) => {
    await toSheet(page, context);
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const home = bar(page).getByRole("button", { name: "Home" });
    await bar(page).getByRole("button", { name: "Office" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(home).toBeFocused();
    const ratio = await home.evaluate((el, src) => {
      const toRgb = new Function(`return (${src})`)() as (c: string) => number[];
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const s = getComputedStyle(el); const a = lum(toRgb(s.outlineColor)), b = lum(toRgb(s.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, rgb.toString());
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
}
