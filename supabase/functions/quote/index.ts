// Story #345: POST /quote. Lines + address + optional coupon in, the one bill out. The data sources are injected so the tests need no network.
// Prices come from the catalog, never from the request. Reads use the project's own URL; rules come from the versioned params row `quote_rules`.
import { quote, pickAlternative, DEFAULT_RULES, DEFAULT_SWAP_PCT, MAX_QTY, type Catalog, type Coupon, type MenuRow, type Rules } from "./quote.ts";
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

export type Offer = { code: string; title: string; saves_paise: number };
export type Deps = {
  catalog: (kitchenId: string, menuItemIds: string[], optionIds: string[]) => Promise<Catalog>;
  rules: (kitchenId: string) => Promise<Rules>;
  session: (req: Request) => Promise<string | null>;   // who is asking: the login's user id, or null
  coupon: (code: string, session: string | null) => Promise<Coupon | null>;
  coupons: (session: string | null) => Promise<Coupon[]>;   // story #346: every coupon valid now (the database decides); story #579: plus this customer's own
  validate: (menuItemId: string, optionIds: string[]) => Promise<{ ok: true } | { ok: false; error: string; message: string }>;
  firstOrder: (kitchenId: string) => Promise<boolean>;
  // story #619 layer b (optional, so a caller without them just has no alternatives): every dish of the kitchen, and the admin's swap discount percent
  menu?: (kitchenId: string) => Promise<MenuRow[]>;
  swapPct?: () => Promise<number>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 30;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const bad = () => json(400, { ok: false, error: "invalid_request" });

type Line = { menu_item_id: string; qty: number; option_ids: string[]; swap?: boolean };
export function parse(b: any): { kitchen: string; lines: Line[]; code: string | null; none: boolean } | null {
  if (!b || typeof b !== "object" || !UUID.test(b.kitchen_id) || !Array.isArray(b.lines) || b.lines.length > MAX_LINES) return null;
  if (typeof b.address?.pin_code !== "string" || !/^\d{6}$/.test(b.address.pin_code)) return null;
  if (b.coupon_code != null && (typeof b.coupon_code !== "string" || b.coupon_code.length > 40)) return null;
  if (b.no_coupon != null && typeof b.no_coupon !== "boolean") return null;   // story #589: true means no coupon, not even the best one
  if (b.no_coupon === true && b.coupon_code) return null;
  const lines: Line[] = [];
  for (const l of b.lines) {
    const ids = l?.option_ids ?? [];
    if (!UUID.test(l?.menu_item_id) || !Array.isArray(ids) || ids.length > 20 || !ids.every((i: unknown) => typeof i === "string" && UUID.test(i))) return null;
    lines.push({ menu_item_id: l.menu_item_id, qty: l.qty, option_ids: ids, ...(l.swap === true ? { swap: true } : {}) });
  }
  return { kitchen: b.kitchen_id, lines, code: b.coupon_code ? b.coupon_code.trim().toUpperCase() : null, none: b.no_coupon === true };
}

// The quote itself, shared with POST /orders (#347): one way to price a cart. Throws when a data source fails.
export async function runQuote(deps: Deps, q: { kitchen: string; lines: Line[]; code: string | null; none: boolean }, session: string | null = null): Promise<(Extract<ReturnType<typeof quote>, { ok: true }> & { offers: Offer[] }) | { ok: false; error: string; message: string }> {
  const catalog = await deps.catalog(q.kitchen, q.lines.map((l) => l.menu_item_id), q.lines.flatMap((l) => l.option_ids));
  const checks = new Map<string, Awaited<ReturnType<Deps["validate"]>>>();
  for (const l of q.lines) if (catalog.dishes[l.menu_item_id] && l.option_ids.every((o) => catalog.options[o])) checks.set(l.menu_item_id + l.option_ids.join(), await deps.validate(l.menu_item_id, l.option_ids));
  // story #619 layer b: only when a requested dish is sold out do we read the whole menu and the percent, and check the pick can be ordered with no add-ons
  const soldOut = q.lines.map((l) => catalog.dishes[l.menu_item_id]).filter((d) => d && !d.available);
  const menu = soldOut.length && deps.menu ? await deps.menu(q.kitchen) : [];
  const swap_pct = soldOut.length && deps.swapPct ? Math.min(50, Math.max(0, Math.floor(await deps.swapPct()))) : DEFAULT_SWAP_PCT;
  for (const d of soldOut) {
    const alt = pickAlternative(d, menu, swap_pct);
    if (alt) checks.set(alt.menu_item_id, await deps.validate(alt.menu_item_id, []));
  }
  const typed = q.code ? await deps.coupon(q.code, session) : null;
  if (q.code && !typed) return { ok: false, error: "coupon_invalid", message: `${q.code} is not a valid code.` };
  // A pick for an option the catalog does not know is refused by the same code the database function uses.
  const validate = (id: string, opts: string[]) => checks.get(id + opts.join()) ?? { ok: false as const, error: "unknown_option", message: "This option is not on this dish." };
  const rules = await deps.rules(q.kitchen);
  // Story #346: try every valid coupon on this cart. The ones that apply are the offers; the best saving is applied (a tie: the smaller code), unless the customer typed a code.
  const list = await deps.coupons(session);
  const first = list.some((c) => c.first_order_only) || typed?.first_order_only ? await deps.firstOrder(q.kitchen) : false;
  const input = { lines: q.lines, first_order: first, menu, swap_pct };
  const offers: Offer[] = [];
  for (const c of list) {
    const r = quote(input, catalog, rules, c, validate);
    if (r.ok && r.discount_paise - (r.swap_discount_paise ?? 0) > 0) offers.push({ code: c.code, title: c.title, saves_paise: r.discount_paise - (r.swap_discount_paise ?? 0) });   // the swap discount is not a coupon
  }
  offers.sort((a, b) => b.saves_paise - a.saves_paise || (a.code < b.code ? -1 : 1));
  const chosen = q.none ? null : typed ?? list.find((c) => c.code === offers[0]?.code) ?? null;
  const out = quote(input, catalog, rules, chosen, validate);
  return out.ok ? { ...out, offers } : out;
}

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  let body: unknown;
  try { body = await req.json(); } catch { return bad(); }
  const q = parse(body);
  if (!q) return bad();
  try {
    const out = await runQuote(deps, q, await deps.session(req));
    if (!out.ok) return json(422, out);
    const { effective: _effective, ...shown } = out;   // the lines to order are for POST /orders, not for the screen
    return json(200, { ...shown, kitchen_id: q.kitchen });
  } catch {
    return json(502, { ok: false, error: "quote_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data sources: PostgREST with the project's own URL. Catalog and rpc use the caller-level anon key (menu_items and options are public to read).
// ponytail: no customer identity until phone login (#339), so first_order is false and a first-order coupon is refused.  Coupons (#346) come from the database with the service key.
const url = () => Deno.env.get("SUPABASE_URL")!;
const headers = (key: string) => ({ apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" });
const anon = () => headers(Deno.env.get("SUPABASE_ANON_KEY")!);
const get = async (path: string, h: Record<string, string>) => {
  const res = await fetch(`${url()}/rest/v1/${path}`, { headers: h });
  if (!res.ok) throw new Error("read failed");
  return await res.json();
};
const rpc = async (fn: string, body: Record<string, unknown>) => {   // the coupon functions are for the service role only
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${url()}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers(key), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("rpc failed");
  return await res.json();
};
export const live: Deps = {
  catalog: async (kitchenId, dishIds, optionIds) => {
    const dishes = await get(`menu_items?select=id,name,price_paise,available,veg&kitchen_id=eq.${kitchenId}&id=in.(${dishIds.join(",") || "null"})`, anon());
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
  session: async (req) => {   // an anonymous user has a token too; anything that does not check out is no session
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!token) return null;
    const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()).id ?? null) : null;
  },
  coupon: async (code, session) => (await rpc("coupon_by_code_v2", { p_code: code, p_session: session })) as Coupon | null,
  coupons: async (session) => (await rpc("coupons_for_session_v2", { p_session: session })) as Coupon[],
  firstOrder: async () => false,
  menu: async (kitchenId) => await get(`menu_items?select=id,name,price_paise,available,veg&kitchen_id=eq.${kitchenId}`, anon()) as MenuRow[],
  swapPct: async () => {   // the admin's setting (migration 20261029100000); the default stands if it cannot be read
    try {
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // settings is not public to read
      const rows = await get("settings?select=value&name=eq.swap_discount_pct&limit=1", headers(key));
      return rows.length && Number.isFinite(Number(rows[0].value)) ? Number(rows[0].value) : DEFAULT_SWAP_PCT;
    } catch { return DEFAULT_SWAP_PCT; }
  },
};
export const handler = withRunLog("quote", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
