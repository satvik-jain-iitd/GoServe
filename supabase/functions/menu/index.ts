// Story #343: GET /menu?kitchen=<uuid>. The menu of one kitchen: categories, collections, badges, sold-out and back-soon flags.
// The data source is injected so the tests need no network; the real one reads menu_items with the caller's key under row level security.
import { buildMenu, type DishRow } from "./menu.ts";

export type Deps = { rows: (kitchenId: string) => Promise<DishRow[]>; now: () => Date };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  const kitchen = new URL(req.url).searchParams.get("kitchen") ?? "";
  if (!UUID.test(kitchen)) return json(400, { ok: false, error: "invalid_kitchen" });
  try {
    const menu = buildMenu(await deps.rows(kitchen), deps.now());
    return json(200, { ok: true, kitchen_id: kitchen, ...menu });
  } catch {
    return json(502, { ok: false, error: "menu_unavailable" });   // no detail: a database message must never reach an app
  }
};

// The real data source: PostgREST with the project's own URL and the caller's key (the anon key is enough: menu_items is public to read).
const COLUMNS = "id,name,price_paise,available,veg,category,sort,image_url,badge,size_tag,protein_g,back_soon_at,created_at";
const live: Deps = {
  now: () => new Date(),
  rows: async (kitchenId) => {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/menu_items?select=${COLUMNS}&kitchen_id=eq.${kitchenId}`, {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    });
    if (!res.ok) throw new Error("menu read failed");
    return await res.json();
  },
};
export const handler = makeHandler(live);

if (import.meta.main) Deno.serve(handler);
