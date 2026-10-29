// Shared by the kitchen, rider and tracker specs (stories #49 and #50). Supabase REST, the live socket and the n8n webhook are answered by the test.
// The live socket speaks the Phoenix protocol version 2 (arrays), as supabase-js 2.x does.
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page } from "@playwright/test";

export const SESSION = "7e57ab1e-0000-4000-8000-0000000000a1";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: SESSION, role: "authenticated", is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
export const ID = "0f0f0f0f-1111-4222-8333-444444444444";
export const order = (status: string, updated = "2020-01-01T10:00:00Z", created = "2020-01-01T10:00:00Z") => ({
  id: ID, session_id: SESSION, kitchen_id: "k", client_order_key: "k1", status, address: "Flat 4, Green Park",
  items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 2, price_paise: 32000 }], total_paise: 64000, created_at: created, updated_at: updated,
});

export const decisionOf = (over: object = {}) => ({
  use_case: "D1", rule_pick: "r2", chosen_pick: "r2", chosen_by: "rule", jev_status: "ok", jev: { pick: "r2", confidence: 0.81, agrees: true, ms: 310 }, ...over,
});

type Calls = { riderWrites: { method: string; body: any }[]; customerWrites: { method: string; body: any }[]; menuReads: string[]; menuWrites: { method: string; url: string; body: any }[]; uploads: string[]; kitchenWrites: { method: string; url: string; body: any }[]; signups: number; status: any[]; decide: any[]; health: any[]; feedback: any[]; confirm: any[]; rpc: { name: string; body: any }[]; orderReads: string[]; staffReads: string[]; riderReads: string[]; sim: { headers: Record<string, string>; body: any }[]; engine: { headers: Record<string, string>; body: any }[] };
// `pin` is the pin code this device already knows (story B2); pass null for a first visit. The test kitchen k-1 serves 110016.
// The shared kitchen is open all day (00:00 to 23:59 India) so that a run at any hour meets an open kitchen (story #321: hours are obeyed). Specs that test the hours set their own clock and hours.
export async function setup(context: BrowserContext, page: Page, initial: object[] = [], { pin = "110016" as string | null } = {}) {
  if (pin) await context.addInitScript((p) => { try { if (!window.localStorage.getItem("gs-pin")) window.localStorage.setItem("gs-pin", p); } catch { /* blocked */ } }, pin);
  const calls: Calls = { riderWrites: [], customerWrites: [], menuReads: [], menuWrites: [], uploads: [], kitchenWrites: [], signups: 0, status: [], decide: [], health: [], feedback: [], confirm: [], rpc: [], orderReads: [], staffReads: [], riderReads: [], sim: [], engine: [] };
  const state = { swapPct: 10, rpcError: null as null | { name: string; message: string }, confirmCfg: { confirm_after_ready_min: 3, confirm_after_place_min: 8 }, confirmDone: false, confirmAt: null as null | string, feedbackDown: false, orders: initial, reply: null as null | { status: number; body: unknown }, menuUp: true, kitchen: null as null | string, staffOther: null as null | string, otherRider: false, rider: { user_id: SESSION, name: "Rider", online: true, lat: null, lng: null } as null | { online: boolean; [k: string]: unknown }, customer: null as null | object, numbers: [] as object[], admin: false, people: [] as object[], kitchens: [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }] as object[], menu: [{ id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null }] as object[], riderCard: null as null | { name: string; phone: string }, anonymous: true, riders: null as null | object[], ridersFail: false, decisions: [] as object[], runs: [] as object[], runCount: 0, sim: { enabled: false, kitchens: 10, riders: 40, riders_online: 29, dishes: 137, knobs: { reject_pct: 5, sold_out_pct: 3, delay_pct: 10, rider_drop_pct: 2 } as Record<string, number | boolean | undefined> }, engine: { engine: "rules", version: 1, by: "system", changed_at: "2026-10-25T04:00:00Z" }, engineReply: null as null | { status: number; body: unknown } };
  const json = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes("/auth/v1/signup")) {
      calls.signups++;
      return json(route, 200, { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: state.anonymous, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (req.url().includes("/rest/v1/rpc/")) {
      const name = req.url().split("/rest/v1/rpc/")[1].split("?")[0];
      calls.rpc.push({ name, body: JSON.parse(req.postData() ?? "{}") });
      if (state.rpcError && state.rpcError.name === name) return json(route, 400, { message: state.rpcError.message });   // #466: one database function refuses with this code
      if (name === "swap_discount_get_v2") return json(route, 200, { pct: state.swapPct, updated_by: "owner@goserve.test", updated_at: "2026-10-29T14:10:00Z" });   // #619 layer d, board A9
      if (name === "swap_discount_set_v2") {
        const p = JSON.parse(req.postData() ?? "{}").p_pct;
        if (!Number.isInteger(p) || p < 0 || p > 50) return json(route, 200, { ok: false, error: "invalid_percent", message: "Pick a whole number from 0 to 50." });
        state.swapPct = p;
        return json(route, 200, { ok: true });
      }
      if (name === "is_admin") return json(route, 200, state.admin);   // A2: the admin screen asks once
      if (name === "admin_people") return json(route, 200, state.people);
      if (name === "order_rider") return json(route, 200, state.riderCard ? [state.riderCard] : []);   // D2: the rider card
      if (name === "reset_session") state.orders = [];
      return json(route, 200, name === "reset_session" ? { orders: 1 } : null);
    }
    if (req.url().includes("/rest/v1/riders")) {   // A5: the rider's own row (online, location)
      if (req.method() === "GET") {
        calls.riderReads.push(req.url());
        if (state.ridersFail) return json(route, 500, { message: "down" });   // H12b: an unreadable riders table
        const rows = state.riders ?? [...(state.otherRider ? [{ user_id: "other-rider", name: "Other", online: false }] : []), ...(state.rider ? [state.rider] : [])];   // H12b: an admin's list
        const who = new URL(req.url()).searchParams.get("user_id")?.replace("eq.", "");
        return json(route, 200, rows.filter((r: any) => !who || r.user_id === who));
      }
      const body = JSON.parse(req.postData() ?? "{}");
      calls.riderWrites.push({ method: req.method(), body });
      if (state.rider) Object.assign(state.rider, body);
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/day_numbers")) return json(route, 200, state.numbers);   // A4: the day's numbers
    if (req.url().includes("/rest/v1/customers")) {   // B3: the customer's saved details
      if (req.method() === "GET") return json(route, 200, state.customer ? [state.customer] : []);
      calls.customerWrites.push({ method: req.method(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/auth/v1/logout")) return route.fulfill({ status: 204, headers: CORS, body: "" });
    if (req.url().includes("/auth/v1/user")) return json(route, 200, { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: state.anonymous, app_metadata: {}, user_metadata: state.anonymous ? {} : { full_name: "Amit Kumar" }, created_at: new Date().toISOString() });   // H11: who is signed in
    if (req.url().includes("/rest/v1/kitchens")) {   // A2: the admin's kitchen list and writes
      if (req.method() === "GET") return json(route, 200, state.kitchens);
      calls.kitchenWrites.push({ method: req.method(), url: req.url(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/kitchen_staff")) {   // S-M5: the kitchen this user works for; H3: an admin also sees other people's rows, so the query must filter by user
      calls.staffReads.push(req.url());
      const rows = [...(state.staffOther ? [{ kitchen_id: state.staffOther, user_id: "someone-else" }] : []), ...(state.kitchen ? [{ kitchen_id: state.kitchen, user_id: SESSION }] : [])];
      const who = new URL(req.url()).searchParams.get("user_id")?.replace("eq.", "");
      return json(route, 200, rows.filter((r) => !who || r.user_id === who).map((r) => ({ kitchen_id: r.kitchen_id })));
    }
    if (req.url().includes("/rest/v1/decision_log")) return json(route, 200, state.decisions);
    if (req.url().includes("/rest/v1/run_log")) {
      const total = state.runCount || state.runs.length;
      if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": `*/${total}` } });   // the count query
      const rows = req.url().includes("workflow=like") ? state.runs.filter((r: any) => String(r.workflow).endsWith(": decide")).slice(0, 1) : state.runs;   // the last-decide query
      const limit = Number(new URL(req.url()).searchParams.get("limit") ?? rows.length);   // like PostgREST: only the first rows come back
      return json(route, 200, rows.slice(0, limit));
    }
    if (req.url().includes("/rest/v1/orders")) {
      calls.orderReads.push(req.url());
      return json(route, 200, state.orders);
    }
    if (req.url().includes("/rest/v1/menu_items") && req.method() === "GET") calls.menuReads.push(req.url());
    if (req.url().includes("/rest/v1/menu_items") && req.method() !== "GET") {   // A3: the admin's dish writes
      calls.menuWrites.push({ method: req.method(), url: req.url(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/menu_items") && !state.menuUp) return json(route, 500, {});
    if (req.url().includes("/rest/v1/menu_items")) return json(route, 200, state.menu);
    return json(route, 404, {});
  });
  await context.route("https://test.supabase.co/storage/v1/object/**", async (route) => {   // A3: photo upload
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.uploads.push(req.url());
    return json(route, 200, { Key: "menu/x" });
  });
  await context.route("https://sim.test/**", async (route) => {   // H7 (#190): GS MAIN 30 Simulator, answered by the test
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    calls.sim.push({ headers: req.headers(), body });
    if (state.reply) return json(route, state.reply.status, state.reply.body);
    const sim = state.sim;
    if (body.action === "seed") { sim.kitchens = 10; sim.riders = body.riders_per_kitchen * 10; sim.riders_online = Math.round(sim.riders * body.online_pct / 100); sim.dishes = 137; return json(route, 200, { ok: true, kitchens: sim.kitchens, kitchens_open: 10, riders: sim.riders, riders_online: sim.riders_online, dishes: sim.dishes }); }
    if (body.action === "knobs") { sim.knobs = typeof body.demo === "boolean" ? { ...sim.knobs, demo: body.demo } : { reject_pct: body.reject_pct, sold_out_pct: body.sold_out_pct, delay_pct: body.delay_pct, rider_drop_pct: body.rider_drop_pct, demo: sim.knobs.demo }; return json(route, 200, { ok: true, knobs: sim.knobs }); }   // #454: demo mode is one more key on the same action
    if (body.action === "reset") { const gone = { ok: true, kitchens: sim.kitchens, riders: sim.riders, dishes: sim.dishes, orders: 0 }; sim.kitchens = 0; sim.riders = 0; sim.riders_online = 0; sim.dishes = 0; return json(route, 200, gone); }
    if (body.action === "enable" || body.action === "disable") { sim.enabled = body.action === "enable"; return json(route, 200, { ok: true, enabled: sim.enabled }); }
    if (body.action === "tick") return json(route, 200, { ok: true, riders_moved: 14, kitchens_flipped: 1, dishes_flipped: 2, riders_flipped: 1, orders: { accepted: 2, cancelled: 1, delivered: 1, dropped: 0 } });
    return json(route, 200, { ok: true, enabled: sim.enabled, kitchens: sim.kitchens, riders: sim.riders, riders_online: sim.riders_online, dishes: sim.dishes, knobs: sim.knobs });
  });
  await context.route("https://engine.test/**", async (route) => {   // #263: GS MAIN 32 Decision engine, answered by the test
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    calls.engine.push({ headers: req.headers(), body });
    if (state.engineReply) return json(route, state.engineReply.status, state.engineReply.body);
    if (body.action === "set") state.engine = { engine: body.engine, version: state.engine.version + 1, by: "owner@goserve.test", changed_at: new Date().toISOString() };
    return json(route, 200, { ok: true, ...state.engine });
  });
  await context.route("https://orders.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    if (body.action === "health") {
      calls.health.push({ headers: req.headers(), body });
      const r = state.reply ?? { status: 200, body: { ok: true, jev: { ok: true, status: "ok", ms: 310 } } };
      return json(route, r.status, r.body);
    }
    if (body.action === "confirm") {   // story S-C: the customer's Yes
      calls.confirm.push({ headers: req.headers(), body });
      const closed = { ...order("delivered", state.confirmAt ?? new Date(Date.now() + 1000).toISOString()), paid_by: "cash" };
      return json(route, 200, state.confirmDone ? { ok: true, already_done: true, order: closed } : { ok: true, order: closed });
    }
    if (body.action === "feedback") {   // story S-B: a report; when feedbackDown is set the phone cannot reach the server
      if (state.feedbackDown) return route.abort("internetdisconnected");
      calls.feedback.push({ headers: req.headers(), body });
      const r = state.reply ?? { status: 201, body: { ok: true, id: "f1" } };
      return json(route, r.status, r.body);
    }
    if (body.action === "decide") {
      calls.decide.push(body);
      const r = state.reply ?? { status: 200, body: { ok: true, decision: decisionOf() } };
      if (r.status === 200) state.decisions = [{ id: 1, order_id: body.order_id, session_id: SESSION, created_at: new Date().toISOString(), decision: decisionOf() }];
      return json(route, r.status, r.body);
    }
    calls.status.push({ headers: req.headers(), body });
    const later = new Date(Date.now() + 1000).toISOString();
    const fresh =
      body.action === "place" ? { ok: true, created: true, order: { ...order("placed", later), total_paise: 32000 }, ...state.confirmCfg }
      : body.action === "event" ? { ok: true, order: order("out_for_delivery", later) }
      : { ok: true, order: order(body.to_status, later) };
    const r = state.reply ?? { status: body.action === "place" ? 201 : 200, body: fresh };
    return json(route, r.status, r.body);
  });
  // Events pushed before the screen has joined the channel (or just after) wait, like a real event that is sent after the subscription.
  // Story #619: more than one channel can be open (orders, and the kitchen's menu). Each join keeps its own list of what the screen asked to hear.
  const SETTLE_MS = 1500;   // the client needs a moment to bind the join answer; an event sent sooner is dropped
  const sockets: { topic: string; bindings: { event: string; table?: string }[]; send: (m: unknown) => void; joinedAt: number }[] = [];
  const waiting: [string, object, string][] = [];
  const deliver = (type: string, record: object, table: string) => {
    const hits = sockets.filter((c) => Date.now() >= c.joinedAt + SETTLE_MS && c.bindings.some((b) => (b.table ?? "orders") === table));
    for (const c of hits) {
      const idx = c.bindings.findIndex((b) => (b.table ?? "orders") === table && (type === "DELETE" ? b.event === "DELETE" : b.event !== "DELETE"));
      if (idx < 0) continue;
      c.send([null, null, c.topic, "postgres_changes", { ids: [idx + 1],
        data: { schema: "public", table, commit_timestamp: new Date().toISOString(), type, record: type === "DELETE" ? {} : record, old_record: type === "DELETE" ? record : {}, columns: [], errors: null } }]);
    }
    return hits.length > 0;
  };
  const flush = () => { for (const w of waiting.splice(0)) if (!deliver(w[0], w[1], w[2])) waiting.push(w); };
  const push = (type: "INSERT" | "UPDATE" | "DELETE", record: object, table: "orders" | "kitchens" | "menu_items" = "orders") => {
    if (!deliver(type, record, table)) { waiting.push([type, record, table]); setTimeout(flush, SETTLE_MS + 50); }
  };
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    // One socket carries every channel (supabase-js multiplexes), so each join is kept by its topic.
    const send = (m: unknown) => ws.send(JSON.stringify(m));
    ws.onMessage((raw) => {
      const [join_ref, ref, t, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const bindings: { event: string; table?: string }[] = payload?.config?.postgres_changes ?? [];
        const at = sockets.findIndex((c) => c.topic === t);
        const me = { topic: t, bindings, send, joinedAt: Date.now() };
        if (at >= 0) sockets[at] = me; else sockets.push(me);
        ws.send(JSON.stringify([join_ref, ref, t, "phx_reply", { status: "ok", response: { postgres_changes: bindings.map((b, i) => ({ id: i + 1, ...b })) } }]));
        setTimeout(flush, SETTLE_MS + 50);   // a timer may fire a millisecond early: the margin keeps the event from waiting for ever
      } else if (event === "heartbeat") {
        ws.send(JSON.stringify([null, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });
  return { calls, state, push };
}

/** An axe scan after every CSS animation has finished (the stamp fades in from 0.6, which read as low contrast mid-animation). Returns the serious and critical violations as strings. */
export async function scan(page: Page, tags?: string[]): Promise<string[]> {
  // Finite animations only (the ui-pulse skeleton never finishes), and never more than a second: a scan must not hang on a slow CI.
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1000))]));
  const b = new AxeBuilder({ page });
  const r = await (tags ? b.withTags(tags) : b).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

// Story #668: the first question is "Where does the food go?". For the tests that only need a place: type it by hand.
export async function typePlace(page: import("@playwright/test").Page, pin: string, address = "Flat 4, Green Park") {
  await page.getByRole("button", { name: "Type it by hand" }).click();
  await page.getByLabel("Address · food gets delivered here").fill(address);
  await page.getByLabel("Pin code").fill(pin);
}
