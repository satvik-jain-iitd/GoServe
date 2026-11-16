// Story 1592 (owner, 16 Nov 2026): no pill buttons. Every text button (.ui-btn, .btn, the Undo bar's button) is a rectangle with a 6 px corner; the round icon buttons, the switch and the photo
// circles stay round (they are the owner's to pick later). Nothing moves and nothing changes size (rule 23). A button never sits in the phone's corner curve.
// One list of cases, run by Chromium (no-pills.spec.ts) and by WebKit, the iPhone engine (no-pills.webkit.spec.ts). The screens are the ones of docs/screens.txt.
// The box test lays the page out twice (new corner, old pill corner forced back on) and compares every button box: nothing moves, nothing changes size.
import { test, expect, type Page } from "@playwright/test";
import { NINE, STEPS, screens } from "./screensSteps";

const SELECTOR = ".ui-btn, .btn, .ui-undo-bar button";
const CORNER = 6;   // --gs-radius-s

type Btn = { text: string; round: boolean; radius: number[]; x: number; y: number; w: number; h: number };

// The buttons on the screen as it is now. `round` = an icon button or a circle (kept round in this story); everything else is a text button.
const read = (page: Page): Promise<Btn[]> => page.evaluate((sel) => {
  const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
  return [...document.querySelectorAll<HTMLElement>(sel)].filter(visible).map((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const round = el.matches(".icon, .ui-trash") || Math.abs(r.width - r.height) < 2;
    return { text: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24), round,
      radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => parseFloat(v)),
      x: Math.round(r.x * 2) / 2, y: Math.round(r.y * 2) / 2, w: Math.round(r.width * 2) / 2, h: Math.round(r.height * 2) / 2 };
  });
}, SELECTOR);

const open = async (page: Page, context: Parameters<(typeof STEPS)[string]>[0], s: (typeof screens)[number], size?: { width: number; height: number }) => {
  await page.clock.install({ time: NINE });
  await page.setViewportSize(size ?? { width: s.width, height: s.height });
  await STEPS[s.step](context, page, s.path);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))); });   // a sheet that is still sliding has no box yet
};

// The phone's screen corner curve (radius) at the three sizes the owner's phones have (issue 1592). A point of a button must stay 8 px clear of the cut-away part of a screen corner.
const CURVE: [number, number, number][] = [[360, 640, 47], [390, 844, 55], [412, 915, 62]];
const CLEAR = 8;
// 0.5 px of slack (reviewer's call, 16 Nov 2026): the 8 px and the curves of 47, 55 and 62 px are the reviewer's estimates, not a measured rule. With the 6 px corner the full-width bars at 24 px above the edge
// reach 54.16 px from the curve centre at 412x915 (limit 54): the Bill bar, "Back to menu" on Cancelled and the location-off sheet. 0.16 px is under one device pixel; rule 8 (24 px) and "nothing moves" win.
const SLACK = 0.5;
// Points on the outline of a rounded rectangle (the four arcs, 12 points each).
const outline = (b: Btn): [number, number][] => {
  const r = Math.min(Math.max(...b.radius), b.w / 2, b.h / 2);
  const pts: [number, number][] = [];
  const arcs: [number, number, number][] = [[b.x + r, b.y + r, Math.PI], [b.x + b.w - r, b.y + r, 1.5 * Math.PI], [b.x + b.w - r, b.y + b.h - r, 0], [b.x + r, b.y + b.h - r, 0.5 * Math.PI]];
  for (const [cx, cy, a0] of arcs) for (let i = 0; i <= 12; i++) { const a = a0 + (i / 12) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
};
const inCurve = (p: [number, number], w: number, h: number, rad: number): boolean => {
  const corners: [number, number][] = [[rad, rad], [w - rad, rad], [w - rad, h - rad], [rad, h - rad]];
  const [x, y] = p;
  for (const [cx, cy] of corners) {
    const inSquare = (x < rad || x > w - rad) && (y < rad || y > h - rad) && Math.abs(x - cx) <= rad && Math.abs(y - cy) <= rad;
    if (inSquare && Math.hypot(x - cx, y - cy) > rad - CLEAR + SLACK) return true;
  }
  return false;
};

// The screens that carry a bar or a button near the bottom corners: the curve is read on these at the three sizes.
const NEAR_CORNER = ["menu", "bill", "account", "orders", "welcome", "cancelled", "no-kitchen", "founder-note", "deliver-to", "location-off"];

export function noPills() {
  test("the screen list has every screen the cases below need", () => {
    for (const n of NEAR_CORNER) expect(screens.map((s) => s.name), `docs/screens.txt has no screen "${n}"`).toContain(n);
  });

  for (const s of screens) {
    test(`corner ${s.name}: every text button has the one 6 px corner, the round buttons stay round`, async ({ page, context }) => {
      await open(page, context, s);
      const buttons = await read(page);
      for (const b of buttons) {
        if (b.round) expect(Math.min(...b.radius), `${s.name}: round button "${b.text}" stays round`).toBeGreaterThanOrEqual(Math.min(b.w, b.h) / 2 - 1);
        else expect(b.radius, `${s.name}: text button "${b.text}" has the 6 px corner on all four corners`).toEqual([CORNER, CORNER, CORNER, CORNER]);
      }
    });

    test(`box ${s.name}: the corner moves no button and changes no size`, async ({ page, context }) => {
      await open(page, context, s);
      const box = async () => (await read(page)).map(({ text, x, y, w, h }) => ({ text, x, y, w, h }));
      let last = ""; await expect.poll(async () => { const j = JSON.stringify(await box()); const same = j === last; last = j; return same; }, { intervals: [150] }).toBe(true);   // the sheet has settled: two reads agree
      const now = await box();
      // The "before" is the same page with the old pill corner forced back on: same machine, same fonts, so only the corner differs.
      await page.addStyleTag({ content: `${SELECTOR} { border-radius: 999px !important; }` });
      expect(now).toEqual(await box());
    });
  }

  for (const [width, height, rad] of CURVE) {
    for (const name of NEAR_CORNER) {
      test(`curve ${width}x${height} ${name}: no button comes within ${CLEAR} px of the screen corner curve of ${rad} px`, async ({ page, context }) => {
        const s = screens.find((x) => x.name === name)!;
        await open(page, context, s, { width, height });
        const hits = (await read(page)).filter((b) => b.y + b.h <= height && b.x + b.w <= width && outline(b).some((p) => inCurve(p, width, height, rad))).map((b) => `"${b.text}" at ${b.x},${b.y} ${b.w}x${b.h}`);
        expect(hits).toEqual([]);
      });
    }
  }
}
