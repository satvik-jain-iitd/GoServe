// Story 1743 (owner, 20 Nov 2026; design rule 31): "Cancel order" has a red outline and red words, no fill, and keeps its box.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const channels = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function read(page: Page) {
  const btn = page.getByRole("button", { name: "Cancel order" });
  await expect(btn).toBeVisible();
  return btn.evaluate((e) => {
    const box = () => { const q = e.getBoundingClientRect(); return [q.x, q.y, q.width, q.height]; };
    let bg = ""; for (let n: Element | null = e.parentElement; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (!/,\s*0\)$|^transparent$/.test(c)) { bg = c; break; } }
    const cs = getComputedStyle(e); const now = box(); const had = e.classList.contains("danger"); e.classList.remove("danger"); const before = box(); if (had) e.classList.add("danger");
    const probe = document.createElement("i"); probe.style.color = "var(--md-error)"; document.body.append(probe); const error = getComputedStyle(probe).color; probe.remove();
    return { error, color: cs.color, border: cs.borderTopColor, fill: cs.backgroundColor, bg, now, before };
  });
}

for (const size of SIZES) {
  for (const status of ["placed", "accepted"]) {
    test(`AC-1..3 at ${size.width} by ${size.height}, ${status}: Cancel order has a red border, red words, no fill, the same box, 4.5:1`, async ({ page, context }) => {
      await page.setViewportSize(size);
      await setup(context, page, [order(status, "2020-01-01T10:01:00Z")]);
      await page.goto("/customer/");
      const m = await read(page);
      expect(m.color).toBe(m.error);                        // AC-1 the words are the app's error red
      expect(m.border).toBe(m.error);                       // AC-1 and so is the border
      expect(m.fill).toMatch(/,\s*0\)$|^transparent$/);     // AC-1 no fill
      m.now.forEach((v, i) => expect(Math.abs(v - m.before[i])).toBeLessThanOrEqual(0.5));   // AC-2
      expect(contrast(channels(m.color), channels(m.bg))).toBeGreaterThanOrEqual(4.5);   // AC-3
    });
  }
}

test("AC-4 the tap still opens the cancel sheet and cancels nothing", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByRole("dialog", { name: "Cancel this order?" })).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "cancel_order")).toHaveLength(0);
});
