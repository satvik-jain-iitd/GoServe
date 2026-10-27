// Story #607 (row T9 of the #325 sitting), board M3: the chosen side of the veg or non-veg pill is a full pill inside the pill (3px inset, 2px primary border),
// so the border follows the curve and no corner is square. Checked on the real layout: each side's radius is at least half its height, and the sides sit 3px inside the pill.
// (The cream fill and the ring of story #528 are on main only; this check does not depend on them.)
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const MENU = [
  { id: "t1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali" },
  { id: "t2", name: "Non-veg Thali", price_paise: 24000, image_url: null, image_credit: null, veg: false, category: "Thali" },
];

for (const theme of ["day", "night"]) {
  test(`S1 ${theme}: the chosen side is round at both ends, veg and then non-veg, inside a round pill`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.menu = MENU;
    await page.addInitScript((t) => { try { window.localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
    await page.goto("/customer/");
    const pill = page.getByRole("navigation", { name: "Veg or non-veg thali" });
    const shape = (name: string) => pill.getByRole("link", { name, exact: true }).evaluate((a) => {
      const s = getComputedStyle(a), box = a.getBoundingClientRect();
      const p = a.parentElement!, ps = getComputedStyle(p), pbox = p.getBoundingClientRect();
      return { radius: parseFloat(s.borderTopLeftRadius), half: box.height / 2, pillRadius: parseFloat(ps.borderTopLeftRadius), pillHalf: pbox.height / 2, inset: box.top - pbox.top };
    });
    const veg = await shape("Veg thali");
    expect(veg.radius).toBeGreaterThanOrEqual(veg.half);
    expect(veg.pillRadius).toBeGreaterThanOrEqual(veg.pillHalf);
    expect(veg.inset).toBeGreaterThanOrEqual(3);   // the chosen side sits inside the pill, so its corners cannot meet the pill's edge
    await pill.getByRole("link", { name: "Non-veg thali" }).click();
    const nonveg = await shape("Non-veg thali");
    expect(nonveg.radius).toBeGreaterThanOrEqual(nonveg.half);
  });
}
