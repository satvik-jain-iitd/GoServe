// Story #638 (row T2 of the #325 sitting), board M4 option A (replaces the ring of story #607): the chosen half of the veg or non-veg pill is filled with the raised surface colour,
// and the pill's own clip makes it D-shaped. No ring, no inset, no green or red around the mark. The chosen mark is full colour, the other one at 60%.
// Checked on the real layout, Day and Night, veg first and then non-veg.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const MENU = [
  { id: "t1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali" },
  { id: "t2", name: "Non-veg Thali", price_paise: 24000, image_url: null, image_credit: null, veg: false, category: "Thali" },
];

for (const theme of ["day", "night"]) {
  test(`S1 ${theme}: the chosen half is filled with the raised surface and D-shaped by the pill, no ring, the other mark at 60%`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.menu = MENU;
    await page.addInitScript((t) => { try { window.localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
    await page.goto("/customer/");
    const pill = page.getByRole("navigation", { name: "Veg or non-veg thali" });
    const raised = await pill.evaluate((el) => {
      const probe = document.createElement("i");
      probe.style.background = "var(--gs-raised)";
      el.appendChild(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    const look = (name: string) => pill.getByRole("link", { name, exact: true }).evaluate((a) => {
      const s = getComputedStyle(a), p = a.parentElement!, ps = getComputedStyle(p);
      return {
        background: s.backgroundColor, shadow: s.boxShadow, radius: parseFloat(s.borderTopLeftRadius), markOpacity: parseFloat(getComputedStyle(a.querySelector("svg")!).opacity),
        pillRadius: parseFloat(ps.borderTopLeftRadius), pillHalf: p.getBoundingClientRect().height / 2, pillClip: ps.overflow, pillPadding: parseFloat(ps.paddingTop),
        inset: a.getBoundingClientRect().top - p.getBoundingClientRect().top - parseFloat(ps.borderTopWidth),
      };
    });
    for (const [chosen, other, click] of [["Veg thali", "Non-veg thali", null], ["Non-veg thali", "Veg thali", "Non-veg thali"]] as const) {
      if (click) await pill.getByRole("link", { name: click }).click();
      const on = await look(chosen), off = await look(other);
      expect(on.background).toBe(raised);
      expect(on.shadow).toBe("none");                    // no ring
      expect(on.radius).toBe(0);                          // the half has no round corner of its own: the pill's clip shapes it
      expect(on.pillClip).toBe("hidden");
      expect(on.pillRadius).toBeGreaterThanOrEqual(on.pillHalf);
      expect(on.pillPadding).toBe(0);                     // nothing inset: the half reaches the pill's edge
      expect(on.inset).toBeLessThanOrEqual(0.5);
      expect(on.markOpacity).toBe(1);
      expect(off.background).not.toBe(raised);
      expect(off.markOpacity).toBeCloseTo(0.6, 2);
    }
  });
}
