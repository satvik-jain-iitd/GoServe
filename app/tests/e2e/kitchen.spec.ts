// Story #49: the kitchen screen. Supabase REST, the live socket and the n8n webhook are all answered by the test.
// The live socket speaks the Phoenix protocol version 2 (arrays), as supabase-js 2.x does.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const SESSION = "7e57ab1e-0000-4000-8000-0000000000a1";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: SESSION, role: "authenticated", is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const ID = "0f0f0f0f-1111-4222-8333-444444444444";
const order = (status: string, updated = "2020-01-01T10:00:00Z") => ({
  id: ID, session_id: SESSION, kitchen_id: "k", client_order_key: "k1", status, address: "Flat 4, Green Park",
  items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 2, price_paise: 32000 }], total_paise: 64000, created_at: "2020-01-01T10:00:00Z", updated_at: updated,
});

type Calls = { status: any[] };
async function setup(context: BrowserContext, page: Page, initial: object[] = []) {
  const calls: Calls = { status: [] };
  const state = { orders: initial, reply: null as null | { status: number; body: unknown } };
  const json = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes("/auth/v1/signup")) {
      return json(route, 200, { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (req.url().includes("/rest/v1/orders")) return json(route, 200, state.orders);
    if (req.url().includes("/rest/v1/menu_items")) return json(route, 200, [{ id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null }]);
    return json(route, 404, {});
  });
  await context.route("https://orders.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    calls.status.push({ headers: req.headers(), body });
    const r = state.reply ?? { status: 200, body: { ok: true, order: order(body.to_status, new Date(Date.now() + 1000).toISOString()) } };
    return json(route, r.status, r.body);
  });
  // Events pushed before the screen has joined the channel (or just after) wait, like a real event that is sent after the subscription.
  const SETTLE_MS = 1500;   // the client needs a moment to bind the join answer; an event sent sooner is dropped
  let joinedAt = 0;
  let sendNow: (type: string, record: object) => void = () => {};
  const waiting: [string, object][] = [];
  const push = (type: "INSERT" | "UPDATE", record: object) => (joinedAt ? setTimeout(() => sendNow(type, record), Math.max(0, joinedAt + SETTLE_MS - Date.now())) : waiting.push([type, record]));
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    let topic = "";
    sendNow = (type, record) => ws.send(JSON.stringify([null, null, topic, "postgres_changes", { ids: [1], data: { schema: "public", table: "orders", commit_timestamp: new Date().toISOString(), type, record, columns: [], errors: null } }]));
    ws.onMessage((raw) => {
      const [join_ref, ref, t, event] = JSON.parse(String(raw));
      if (event === "phx_join") {
        topic = t;
        ws.send(JSON.stringify([join_ref, ref, t, "phx_reply", { status: "ok", response: { postgres_changes: [{ id: 1, event: "*", schema: "public", table: "orders", filter: `session_id=eq.${SESSION}` }] } }]));
        joinedAt = Date.now();
        setTimeout(() => waiting.splice(0).forEach(([type, record]) => sendNow(type, record)), SETTLE_MS);
      } else if (event === "heartbeat") {
        ws.send(JSON.stringify([null, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });
  return { calls, state, push };
}

const openKitchen = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByRole("heading", { name: "Kitchen" })).toBeVisible();
};

test("S1 a new order appears on the kitchen screen without a refresh", async ({ page, context }) => {
  const net = await setup(context, page);
  await openKitchen(page);
  await expect(page.getByText("No orders yet.")).toBeVisible();
  net.push("INSERT", order("placed"));
  // The 2-second bound is measured against the real server in tests/integration/kitchen.test.ts. Here the wait is longer so a busy test machine does not fail it.
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Butter Chicken × 2")).toBeVisible();
  await expect(page.getByText("New", { exact: true })).toBeVisible();
  await expect(page.getByText("Flat 4, Green Park")).toBeVisible();
});

test("S1 orders already placed show when the kitchen opens", async ({ page, context }) => {
  await setup(context, page, [order("accepted")]);
  await openKitchen(page);
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible();
});

test("S2 Accept, then Start, then Ready: each tap sends the next step as the kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await openKitchen(page);
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start 0f0f0f0f" }).click();
  await expect(page.getByText("Cooking", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ready 0f0f0f0f" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /0f0f0f0f/ })).toHaveCount(0);   // no button after Ready: the rider takes over
  expect(net.calls.status.map((c) => c.body)).toEqual([
    { action: "status", session_id: SESSION, order_id: ID, to_status: "accepted", actor: "kitchen" },
    { action: "status", session_id: SESSION, order_id: ID, to_status: "preparing", actor: "kitchen" },
    { action: "status", session_id: SESSION, order_id: ID, to_status: "ready", actor: "kitchen" },
  ]);
  expect(net.calls.status[0].headers["x-gs-token"]).toBe("demo-token");
});

test("S2 a live update of the same order moves its card and its button", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await openKitchen(page);
  net.push("UPDATE", order("accepted", "2020-01-01T10:01:00Z"));
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible({ timeout: 5000 });
});

test("S2 a refused tap shows the reason and keeps the button", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.reply = { status: 409, body: { ok: false, error: "illegal_step", message: "That step is not allowed now." } };
  await openKitchen(page);
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByRole("alert")).toHaveText("That step is not allowed now.");
  await expect(page.getByRole("button", { name: "Accept 0f0f0f0f" })).toBeEnabled();
});

test("an order the rider has taken leaves the kitchen list", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  await openKitchen(page);
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  net.push("UPDATE", order("out_for_delivery", "2020-01-01T10:09:00Z"));
  await expect(page.getByText("Order 0f0f0f0f")).toHaveCount(0, { timeout: 5000 });
});

test("the customer menu is one tap away and keeps the cart while you look at the kitchen", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: "Kitchen" }).click();
  await expect(page.getByRole("heading", { name: "Kitchen" })).toBeVisible();
  await page.getByRole("button", { name: "Customer" }).click();
  await expect(page.getByRole("button", { name: "View cart (1)" })).toBeVisible();
});
