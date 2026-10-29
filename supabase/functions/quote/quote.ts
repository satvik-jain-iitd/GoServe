// Story #345: the only bill math. Pure: lines + the catalog + the rules + one coupon in, a quote out. Every app shows this number and nothing else.
// Money is whole paise. The default rules add nothing (no fee, no tax), which is what the PWA bill does today: the menu price is the price on the bill.
export type Rules = {
  delivery_fee_paise: number; free_delivery_above_paise: number;   // above 0: delivery is free once the food costs more than this
  packaging_paise: number; tax_pct: number; tax_mode: "inclusive" | "exclusive";
};
export const DEFAULT_RULES: Rules = { delivery_fee_paise: 0, free_delivery_above_paise: 0, packaging_paise: 0, tax_pct: 0, tax_mode: "inclusive" };
export type Coupon = { code: string; title: string; kind: "flat" | "percent"; amount_paise: number; percent: number; cap_paise: number; min_order_paise: number; first_order_only: boolean };
export type Catalog = { dishes: Record<string, { id: string; name: string; price_paise: number; available: boolean; veg?: boolean | null }>; options: Record<string, { id: string; name: string; price_paise: number }> };
// Story #619 layer b: a sold-out line with swap true is replaced by the server's one pick, at the same quantity, with the swap discount on the new item.
export type MenuRow = { id: string; name: string; price_paise: number; veg?: boolean | null; available: boolean };
export type Alternative = { menu_item_id: string; name: string; price_paise: number; discount_paise: number };
export type Input = { lines: { menu_item_id: string; qty: number; option_ids: string[]; swap?: boolean }[]; first_order: boolean; menu?: MenuRow[]; swap_pct?: number };
export type Validate = (menuItemId: string, optionIds: string[]) => { ok: true } | { ok: false; error: string; message: string };
export type Quote = {
  ok: true;
  lines: { menu_item_id: string; name: string; qty: number; unit_paise: number; extras_paise: number; line_paise: number; options: string[] }[];
  item_total_paise: number; fees: { delivery_paise: number; packaging_paise: number; total_paise: number }; discount_paise: number;
  coupon: { code: string; title: string } | null; tax_paise: number; tax_mode: Rules["tax_mode"]; to_pay_paise: number; saved_paise: number;
  // only when a swap happened: the part of discount_paise that is the swap discount, what was swapped, and the lines to order (the sold-out line is gone)
  swap_discount_paise?: number; swaps?: { from: string; to: string; discount_paise: number }[]; effective?: { menu_item_id: string; qty: number; option_ids: string[] }[];
};
export type Refusal = { ok: false; error: string; message: string; alternative?: Alternative | null };

export const MAX_QTY = 20;
const refuse = (error: string, message: string): Refusal => ({ ok: false, error, message });
const rupees = (paise: number) => `Rs ${paise / 100}`;
const halfUp = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));   // integer division, half up

export const MAX_SWAP_PCT = 50;
export const DEFAULT_SWAP_PCT = 10;
const clampPct = (n: number) => Math.min(MAX_SWAP_PCT, Math.max(0, Math.floor(Number.isFinite(n) ? n : DEFAULT_SWAP_PCT)));

/** The one rule: same veg flag, available now, nearest price to the sold-out dish, a tie goes to the lowest id. None gives null. */
export function pickAlternative(soldOut: { id: string; price_paise: number; veg?: boolean | null }, menu: MenuRow[], pct: number): Alternative | null {
  const near = (m: MenuRow) => Math.abs(m.price_paise - soldOut.price_paise);
  const m = menu.filter((x) => x.available && x.id !== soldOut.id && (x.veg ?? null) === (soldOut.veg ?? null)).sort((a, b) => near(a) - near(b) || (a.id < b.id ? -1 : 1))[0];
  return m ? { menu_item_id: m.id, name: m.name, price_paise: m.price_paise, discount_paise: halfUp(m.price_paise * clampPct(pct), 100) } : null;
}

export function quote(input: Input, catalog: Catalog, rules: Rules, coupon: Coupon | null, validate: Validate): Quote | Refusal {
  if (input.lines.length === 0) return refuse("empty_order", "Add a dish first.");
  const lines: Quote["lines"] = [];
  const effective: NonNullable<Quote["effective"]> = [];
  const swaps: NonNullable<Quote["swaps"]> = [];
  let swapDiscount = 0;
  for (const l of input.lines) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) return refuse("invalid_quantity", `Pick 1 to ${MAX_QTY} of a dish.`);
    const dish = catalog.dishes[l.menu_item_id];
    if (!dish) return refuse("unknown_dish", "This dish is not on the menu.");
    if (!dish.available) {
      const alt = pickAlternative(dish, input.menu ?? [], input.swap_pct ?? DEFAULT_SWAP_PCT);
      const usable = alt && validate(alt.menu_item_id, []).ok;   // an alternative that needs a choice of add-ons cannot be swapped in blind
      if (!l.swap || !alt || !usable || swaps.some((s) => s.from === dish.id)) return { ...refuse("dish_sold_out", `${dish.name} is sold out.`), alternative: usable ? alt : null };
      lines.push({ menu_item_id: alt.menu_item_id, name: alt.name, qty: l.qty, unit_paise: alt.price_paise, extras_paise: 0, line_paise: alt.price_paise * l.qty, options: [] });
      effective.push({ menu_item_id: alt.menu_item_id, qty: l.qty, option_ids: [] });
      swaps.push({ from: dish.id, to: alt.menu_item_id, discount_paise: alt.discount_paise * l.qty });
      swapDiscount += alt.discount_paise * l.qty;
      continue;
    }
    const picked = validate(l.menu_item_id, l.option_ids);
    if (!picked.ok) return refuse(picked.error, picked.message);
    const opts = l.option_ids.map((id) => catalog.options[id]);
    const extras = opts.reduce((n, o) => n + o.price_paise, 0);
    lines.push({ menu_item_id: dish.id, name: dish.name, qty: l.qty, unit_paise: dish.price_paise, extras_paise: extras, line_paise: (dish.price_paise + extras) * l.qty, options: opts.map((o) => o.name) });
    effective.push({ menu_item_id: l.menu_item_id, qty: l.qty, option_ids: l.option_ids });
  }
  const item_total = lines.reduce((n, l) => n + l.line_paise, 0);

  const waived = rules.free_delivery_above_paise > 0 && item_total > rules.free_delivery_above_paise;
  const delivery = waived ? 0 : rules.delivery_fee_paise;
  const fees = { delivery_paise: delivery, packaging_paise: rules.packaging_paise, total_paise: delivery + rules.packaging_paise };

  let discount = 0;
  if (coupon) {
    if (item_total < coupon.min_order_paise) return refuse("coupon_minimum", `${coupon.code} needs at least ${rupees(coupon.min_order_paise)} of food.`);
    if (coupon.first_order_only && !input.first_order) return refuse("coupon_first_order", `${coupon.code} is for a first order only.`);
    const raw = coupon.kind === "flat" ? coupon.amount_paise : Math.floor((item_total * coupon.percent) / 100);
    discount = Math.min(coupon.kind === "percent" && coupon.cap_paise > 0 ? Math.min(raw, coupon.cap_paise) : raw, item_total);
  }

  discount = Math.min(discount + swapDiscount, item_total);
  const taxable = item_total + fees.total_paise - discount;
  const tax = rules.tax_pct === 0 ? 0 : rules.tax_mode === "exclusive" ? halfUp(taxable * rules.tax_pct, 100) : halfUp(taxable * rules.tax_pct, 100 + rules.tax_pct);
  const to_pay = taxable + (rules.tax_mode === "exclusive" ? tax : 0);
  const saved = discount + (waived ? rules.delivery_fee_paise : 0);
  return { ok: true, lines, item_total_paise: item_total, fees, discount_paise: discount, coupon: coupon ? { code: coupon.code, title: coupon.title } : null, tax_paise: tax, tax_mode: rules.tax_mode, to_pay_paise: to_pay, saved_paise: saved,
    ...(swaps.length ? { swap_discount_paise: swapDiscount, swaps, effective } : {}) };
}
