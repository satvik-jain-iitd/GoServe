// Story #345: the only bill math. Pure: lines + the catalog + the rules + one coupon in, a quote out. Every app shows this number and nothing else.
// Money is whole paise. The default rules add nothing (no fee, no tax), which is what the PWA bill does today: the menu price is the price on the bill.
export type Rules = {
  delivery_fee_paise: number; free_delivery_above_paise: number;   // above 0: delivery is free once the food costs more than this
  packaging_paise: number; tax_pct: number; tax_mode: "inclusive" | "exclusive";
};
export const DEFAULT_RULES: Rules = { delivery_fee_paise: 0, free_delivery_above_paise: 0, packaging_paise: 0, tax_pct: 0, tax_mode: "inclusive" };
export type Coupon = { code: string; title: string; kind: "flat" | "percent"; amount_paise: number; percent: number; cap_paise: number; min_order_paise: number; first_order_only: boolean };
export type Catalog = { dishes: Record<string, { id: string; name: string; price_paise: number; available: boolean }>; options: Record<string, { id: string; name: string; price_paise: number }> };
export type Input = { lines: { menu_item_id: string; qty: number; option_ids: string[] }[]; first_order: boolean };
export type Validate = (menuItemId: string, optionIds: string[]) => { ok: true } | { ok: false; error: string; message: string };
export type Quote = {
  ok: true;
  lines: { menu_item_id: string; name: string; qty: number; unit_paise: number; extras_paise: number; line_paise: number; options: string[] }[];
  item_total_paise: number; fees: { delivery_paise: number; packaging_paise: number; total_paise: number }; discount_paise: number;
  coupon: { code: string; title: string } | null; tax_paise: number; tax_mode: Rules["tax_mode"]; to_pay_paise: number; saved_paise: number;
};
export type Refusal = { ok: false; error: string; message: string };

export const MAX_QTY = 20;
const refuse = (error: string, message: string): Refusal => ({ ok: false, error, message });
const rupees = (paise: number) => `Rs ${paise / 100}`;
const halfUp = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));   // integer division, half up

export function quote(input: Input, catalog: Catalog, rules: Rules, coupon: Coupon | null, validate: Validate): Quote | Refusal {
  if (input.lines.length === 0) return refuse("empty_order", "Add a dish first.");
  const lines: Quote["lines"] = [];
  for (const l of input.lines) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) return refuse("invalid_quantity", `Pick 1 to ${MAX_QTY} of a dish.`);
    const dish = catalog.dishes[l.menu_item_id];
    if (!dish) return refuse("unknown_dish", "This dish is not on the menu.");
    if (!dish.available) return refuse("dish_sold_out", `${dish.name} is sold out.`);
    const picked = validate(l.menu_item_id, l.option_ids);
    if (!picked.ok) return refuse(picked.error, picked.message);
    const opts = l.option_ids.map((id) => catalog.options[id]);
    const extras = opts.reduce((n, o) => n + o.price_paise, 0);
    lines.push({ menu_item_id: dish.id, name: dish.name, qty: l.qty, unit_paise: dish.price_paise, extras_paise: extras, line_paise: (dish.price_paise + extras) * l.qty, options: opts.map((o) => o.name) });
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

  const taxable = item_total + fees.total_paise - discount;
  const tax = rules.tax_pct === 0 ? 0 : rules.tax_mode === "exclusive" ? halfUp(taxable * rules.tax_pct, 100) : halfUp(taxable * rules.tax_pct, 100 + rules.tax_pct);
  const to_pay = taxable + (rules.tax_mode === "exclusive" ? tax : 0);
  const saved = discount + (waived ? rules.delivery_fee_paise : 0);
  return { ok: true, lines, item_total_paise: item_total, fees, discount_paise: discount, coupon: coupon ? { code: coupon.code, title: coupon.title } : null, tax_paise: tax, tax_mode: rules.tax_mode, to_pay_paise: to_pay, saved_paise: saved };
}
