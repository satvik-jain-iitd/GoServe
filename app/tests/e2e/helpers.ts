// Shared by the kitchen, rider and tracker specs (stories #49 and #50). Supabase REST, the live socket and the n8n webhook are answered by the test.
// The live socket speaks the Phoenix protocol version 2 (arrays), as supabase-js 2.x does.
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

type Calls = { menuReads: string[]; menuWrites: { method: string; url: string; body: any }[]; uploads: string[]; kitchenWrites: { method: string; url: string; body: any }[]; signups: number; status: any[]; decide: any[]; health: any[]; feedback: any[]; confirm: any[]; rpc: { name: string; body: any }[]; orderReads: string[] };
// `pin` is the pin code this device already knows (story B2); pass null for a first visit. The test kitchen k-1 serves 110016.
export async function setup(context: BrowserContext, page: Page, initial: object[] = [], { pin = "110016" as string | null } = {}) {
  if (pin) await context.addInitScript((p) => { try { if (!window.localStorage.getItem("gs-pin")) window.localStorage.setItem("gs-pin", p); } catch { /* blocked */ } }, pin);
  const calls: Calls = { menuReads: [], menuWrites: [], uploads: [], kitchenWrites: [], signups: 0, status: [], decide: [], health: [], feedback: [], confirm: [], rpc: [], orderReads: [] };
  const state = { confirmCfg: { confirm_after_ready_min: 3, confirm_after_place_min: 8 }, confirmDone: false, feedbackDown: false, orders: initial, reply: null as null | { status: number; body: unknown }, menuUp: true, kitchen: null as null | string, admin: false, people: [] as object[], kitchens: [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true }] as object[], decisions: [] as object[], runs: [] as object[], runCount: 0 };
  const json = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes("/auth/v1/signup")) {
      calls.signups++;
      return json(route, 200, { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (req.url().includes("/rest/v1/rpc/")) {
      const name = req.url().split("/rest/v1/rpc/")[1].split("?")[0];
      calls.rpc.push({ name, body: JSON.parse(req.postData() ?? "{}") });
      if (name === "is_admin") return json(route, 200, state.admin);   // A2: the admin screen asks once
      if (name === "admin_people") return json(route, 200, state.people);
      if (name === "reset_session") state.orders = [];
      return json(route, 200, name === "reset_session" ? { orders: 1 } : null);
    }
    if (req.url().includes("/rest/v1/kitchens")) {   // A2: the admin's kitchen list and writes
      if (req.method() === "GET") return json(route, 200, state.kitchens);
      calls.kitchenWrites.push({ method: req.method(), url: req.url(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/kitchen_staff")) return json(route, 200, state.kitchen ? [{ kitchen_id: state.kitchen }] : []);   // S-M5: the kitchen this user works for
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
    if (req.url().includes("/rest/v1/menu_items")) return json(route, 200, [{ id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null }]);
    return json(route, 404, {});
  });
  await context.route("https://test.supabase.co/storage/v1/object/**", async (route) => {   // A3: photo upload
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.uploads.push(req.url());
    return json(route, 200, { Key: "menu/x" });
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
      const closed = { ...order("delivered", new Date(Date.now() + 1000).toISOString()), paid_by: "cash" };
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
  const SETTLE_MS = 1500;   // the client needs a moment to bind the join answer; an event sent sooner is dropped
  let joinedAt = 0;
  let bindings: { event: string }[] = [];   // what the screen asked to hear; the server answers with the same list, numbered
  let sendNow: (type: string, record: object) => void = () => {};
  const waiting: [string, object][] = [];
  const push = (type: "INSERT" | "UPDATE" | "DELETE", record: object) => (joinedAt ? setTimeout(() => sendNow(type, record), Math.max(0, joinedAt + SETTLE_MS - Date.now())) : waiting.push([type, record]));
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    let topic = "";
    sendNow = (type, record) => ws.send(JSON.stringify([null, null, topic, "postgres_changes", { ids: [bindings.findIndex((b) => (type === "DELETE" ? b.event === "DELETE" : b.event !== "DELETE")) + 1],
      data: { schema: "public", table: "orders", commit_timestamp: new Date().toISOString(), type, record: type === "DELETE" ? {} : record, old_record: type === "DELETE" ? record : {}, columns: [], errors: null } }]));
    ws.onMessage((raw) => {
      const [join_ref, ref, t, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        topic = t;
        bindings = payload?.config?.postgres_changes ?? [];
        ws.send(JSON.stringify([join_ref, ref, t, "phx_reply", { status: "ok", response: { postgres_changes: bindings.map((b, i) => ({ id: i + 1, ...b })) } }]));
        joinedAt = Date.now();
        setTimeout(() => waiting.splice(0).forEach(([type, record]) => sendNow(type, record)), SETTLE_MS);
      } else if (event === "heartbeat") {
        ws.send(JSON.stringify([null, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });
  return { calls, state, push };
}
