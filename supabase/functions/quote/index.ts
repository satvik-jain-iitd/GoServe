// Story #345: POST /quote. Lines + address + optional coupon in, the one bill out. The data sources are injected so the tests need no network.
// Prices come from the catalog, never from the request. Reads use the project's own URL; rules come from the versioned params row `quote_rules`.
import { quote, DEFAULT_RULES, MAX_QTY, type Catalog, type Coupon, type Rules } from "./quote.ts";

export type Deps = {
  catalog: (kitchenId: string, menuItemIds: string[], optionIds: string[]) => Promise<Catalog>;
  rules: (kitchenId: string) => Promise<Rules>;
  coupon: (code: string) => Promise<Coupon | null>;
  validate: (menuItemId: string, optionIds: string[]) => Promise<{ ok: true } | { ok: false; error: string; message: string }>;
  firstOrder: (kitchenId: string) => Promise<boolean>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 30;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const bad = () => json(400, { ok: false, error: "invalid_request" });

type Line = { menu_item_id: string; qty: number; option_ids: string[] };
export function parse(b: any): { kitchen: string; lines: Line[]; code: string | null } | null {
  if (!b || typeof b !== "object" || !UUID.test(b.kitchen_id) || !Array.isArray(b.lines) || b.lines.length > MAX_LINES) return null;
  if (typeof b.address?.pin_code !== "string" || !/^\d{6}$/.test(b.address.pin_code)) return null;
  if (b.coupon_code != null && (typeof b.coupon_code !== "string" || b.coupon_code.length > 40)) return null;
  const lines: Line[] = [];
  for (const l of b.lines) {
    const ids = l?.option_ids ?? [];
    if (!UUID.test(l?.menu_item_id) || !Array.isArray(ids) || ids.length > 20 || !ids.every((i: unknown) => typeof i === "string" && UUID.test(i))) return null;
    lines.push({ menu_item_id: l.menu_item_id, qty: l.qty, option_ids: ids });
  }
  return { kitchen: b.kitchen_id, lines, code: b.coupon_code ? b.coupon_code.trim().toUpperCase() : null };
}

// The quote itself, shared with POST /orders (#347): one way to price a cart. Throws when a data source fails.
export async function runQuote(deps: Deps, q: { kitchen: string; lines: Line[]; code: string | null }): Promise<ReturnType<typeof quote> | { ok: false; error: string; message: string }> {
  const catalog = await deps.catalog(q.kitchen, q.lines.map((l) => l.menu_item_id), q.lines.flatMap((l) => l.option_ids));
  const checks = new Map<string, Awaited<ReturnType<Deps["validate"]>>>();
  for (const l of q.lines) if (catalog.dishes[l.menu_item_id] && l.option_ids.every((o) => catalog.options[o])) checks.set(l.menu_item_id + l.option_ids.join(), await deps.validate(l.menu_item_id, l.option_ids));
  const coupon = q.code ? await deps.coupon(q.code) : null;
  if (q.code && !coupon) return { ok: false, error: "coupon_invalid", message: `${q.code} is not a valid code.` };
  const first = coupon?.first_order_only ? await deps.firstOrder(q.kitchen) : false;
  // A pick for an option the catalog does not know is refused by the same code the database function uses.
  const validate = (id: string, opts: string[]) => checks.get(id + opts.join()) ?? { ok: false as const, error: "unknown_option", message: "This option is not on this dish." };
  return quote({ lines: q.lines, first_order: first }, catalog, await deps.rules(q.kitchen), coupon, validate);
}

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  let body: unknown;
  try { body = await req.json(); } catch { return bad(); }
  const q = parse(body);
  if (!q) return bad();
  try {
    const out = await runQuote(deps, q);
    return json(out.ok ? 200 : 422, out.ok ? { ...out, kitchen_id: q.kitchen } : out);
  } catch {
    return json(502, { ok: false, error: "quote_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data sources: PostgREST with the project's own URL. Catalog and rpc use the caller-level anon key (menu_items and options are public to read).
// ponytail: no customer identity until phone login (#339), so first_order is false and a first-order coupon is refused; coupons table is #346, so every code is unknown.
const url = () => Deno.env.get("SUPABASE_URL")!;
const headers = (key: string) => ({ apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" });
const anon = () => headers(Deno.env.get("SUPABASE_ANON_KEY")!);
const get = async (path: string, h: Record<string, string>) => {
  const res = await fetch(`${url()}/rest/v1/${path}`, { headers: h });
  if (!res.ok) throw new Error("read failed");
  return await res.json();
};
export const live: Deps = {
  catalog: async (kitchenId, dishIds, optionIds) => {
    const dishes = await get(`menu_items?select=id,name,price_paise,available&kitchen_id=eq.${kitchenId}&id=in.(${dishIds.join(",") || "null"})`, anon());
    const options = optionIds.length ? await get(`options?select=id,name,price_paise&id=in.(${optionIds.join(",")})`, anon()) : [];
    return { dishes: Object.fromEntries(dishes.map((d: any) => [d.id, d])), options: Object.fromEntries(options.map((o: any) => [o.id, o])) };
  },
  validate: async (menuItemId, optionIds) => {
    const res = await fetch(`${url()}/rest/v1/rpc/validate_options`, { method: "POST", headers: anon(), body: JSON.stringify({ p_menu_item: menuItemId, p_option_ids: optionIds }) });
    if (!res.ok) throw new Error("rpc failed");
    return await res.json();
  },
  rules: async (kitchenId) => {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // params is not public to read
    const rows = await get(`params?select=value&kitchen_id=eq.${kitchenId}&session_id=eq.global&key=eq.quote_rules&order=version.desc&limit=1`, headers(key));
    return rows.length ? { ...DEFAULT_RULES, ...rows[0].value } : DEFAULT_RULES;
  },
  coupon: async () => null,
  firstOrder: async () => false,
};
export const handler = makeHandler(live);

if (import.meta.main) Deno.serve(handler);
