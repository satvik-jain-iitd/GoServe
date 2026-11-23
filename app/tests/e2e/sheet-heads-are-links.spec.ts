// Story 1749 sweep: in every bottom sheet a Close WORD in the head is the plain underlined brand link, never a button.
// Sheets found (all four apps), and what the sweep did:
//  - shared Sheet (Styleguide "Demo sheet"): link, converted in story 1749, asserted here.
//  - Remove kitchen, Clear everything (shared DangerSheet): head holds a round 44 px cross, an icon. The ONE named exception: the owner's
//    complaint is the big Close button with a word, not the small cross. Asserted below as an icon-only 44 px round control.
//  - No Close in the head, nothing to convert: Cancel, Sign out, Delete account, Where to deliver, Location off, OTP, Feedback (Close is in the foot pair),
//    dish sheet and Filter in MenuScreen (Close is in the foot pair), Bill swap, Order and Decline sheets, delete address, PinMap details.
//  - skipped: app/src/screens/AdminCity.tsx (kitchen edit sheet has a round cross icon like DangerSheet; file fenced for other stories)
//  - AdminMenu dish sheet: round cross icon, same exception as DangerSheet, left as is.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

type Ctx = Parameters<typeof setup>[0];
const KITCHEN = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };

const demo = async (page: Page, context: Ctx) => {
  await setup(context, page); await page.goto("/styleguide/");
  await page.getByRole("button", { name: "Open sheet" }).click();
  return page.getByRole("dialog", { name: "Demo sheet" });
};
const danger = async (page: Page, context: Ctx) => {
  const net = await setup(context, page); net.state.admin = true; net.state.kitchens = [KITCHEN];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
  return page.getByRole("dialog", { name: "Remove Tau Ka Dhaba?" });
};

test("shared Sheet: head Close is a link (no border, no background, underline, brand colour, 44x44)", async ({ page, context }) => {
  const sheet = await demo(page, context);
  const m = await sheet.evaluate((s) => {
    const b = s.querySelector(".ui-sheet-head button")!, cs = getComputedStyle(b), r = b.getBoundingClientRect();
    return { text: b.textContent, border: cs.borderTopWidth, bg: cs.backgroundColor, deco: cs.textDecorationLine, color: cs.color, link: getComputedStyle(document.documentElement).getPropertyValue("--md-primary"), w: r.width, h: r.height, cls: b.className };
  });
  expect(m.text).toBe("Close"); expect(m.cls).toContain("ui-link");
  expect(m.border).toBe("0px"); expect(m.bg).toMatch(/, 0\)$/); expect(m.deco).toContain("underline");
  expect(m.w).toBeGreaterThanOrEqual(44); expect(m.h).toBeGreaterThanOrEqual(44);
});

test("DangerSheet (named exception): the head control is an icon-only 44 px round cross, never a word button", async ({ page, context }) => {
  const sheet = await danger(page, context);
  const m = await sheet.evaluate((s) => { const b = s.querySelector(".ui-danger-head button")!, r = b.getBoundingClientRect(); return { text: b.textContent?.trim(), svg: !!b.querySelector("svg"), w: r.width, h: r.height, radius: getComputedStyle(b).borderTopLeftRadius }; });
  expect(m.text).toBe(""); expect(m.svg).toBe(true);
  expect(Math.round(m.w)).toBe(44); expect(Math.round(m.h)).toBe(44);
  expect(parseFloat(m.radius)).toBeGreaterThanOrEqual(22);
});

test("guard: a head control that says Close is always the link", async ({ page, context }) => {
  for (const open of [demo, danger]) {
    const sheet = await open(page, context);
    const bad = await sheet.evaluate((s) => [...s.querySelectorAll(".ui-sheet-head button, .ui-danger-head button")].filter((b) => /close/i.test(b.textContent ?? "") && !b.classList.contains("ui-link")).length);
    expect(bad).toBe(0);
    await page.goto("about:blank");
  }
});
