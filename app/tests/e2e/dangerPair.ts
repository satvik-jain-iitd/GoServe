// Story 1704 (owner, 20 Nov 2026): every danger sheet ends in a half and half pair, the red risky button left, the safe one last (right).
// Measured in a real browser, as signOutSheet.ts does. Shared by danger-sheet.spec.ts and dish-edit.spec.ts. Returns the raw numbers so a run can print them.
import { expect, type Locator } from "@playwright/test";

export async function expectDangerPair(sheet: Locator, risky: string, safe: string) {
  const [r, s] = [sheet.getByRole("button", { name: risky, exact: true }), sheet.getByRole("button", { name: safe, exact: true })];
  const m = await sheet.evaluate((el, [rn, sn]) => {
    const acts = el.querySelector(".ui-danger-acts")!, pair = acts.querySelector(":scope > .ui-row-pair");
    const btns = Array.from(el.querySelectorAll(".ui-danger-acts .ui-row-pair > .ui-btn")) as HTMLElement[];
    const box = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const lines = (e: HTMLElement) => { const g = document.createRange(); g.selectNodeContents(e); const cs = getComputedStyle(e); return { text: g.getBoundingClientRect().height, line: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 }; };
    const cs = getComputedStyle(acts);
    return { hasPair: !!pair, names: btns.map((b) => b.textContent), red: btns.map((b) => b.className.includes("danger-fill")), disabled: btns.map((b) => (b as HTMLButtonElement).disabled),
      a: btns[0] ? box(btns[0]) : null, b: btns[1] ? box(btns[1]) : null, inner: { x: box(acts).x + parseFloat(cs.paddingLeft), w: box(acts).w - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) },
      l: btns.map(lines), rn, sn };
  }, [risky, safe]);
  expect(m.hasPair, "the pair sits inside .ui-danger-acts").toBe(true);
  expect(m.names).toEqual([risky, safe]);
  expect(m.red).toEqual([true, false]);   // red is the risky one, on the left
  expect(m.disabled[0], "the red button is asleep until the word is typed").toBe(true);
  const [a, b] = [m.a!, m.b!];
  expect(a.x).toBeLessThan(b.x);
  expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
  expect(a.h).toBeGreaterThanOrEqual(44);
  expect(Math.abs(a.x - m.inner.x)).toBeLessThanOrEqual(1);   // together they fill the content width
  expect(Math.abs(b.x + b.w - (m.inner.x + m.inner.w))).toBeLessThanOrEqual(1);
  for (const l of m.l) expect(l.text, `one line of text ${JSON.stringify({ a, b, l })}`).toBeLessThan(1.5 * l.line);
  await expect(r).toBeVisible(); await expect(s).toBeVisible();
  return { a, b, inner: m.inner, lines: m.l };
}
