// Story #48: menu, cart, bill, place order. Every network call is answered by the test, so this runs without Supabase or n8n.
// Build-time keys come from playwright.config.ts (VITE_SUPABASE_URL=https://test.supabase.co, VITE_ORDER_URL=https://orders.test/gs-order).
import { test, expect, type BrowserContext } from "@playwright/test";

const SESSION = "7e57ab1e-0000-4000-8000-0000000000a1";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: SESSION, role: "authenticated", is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const MENU = [
  { id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: "https://img.test/a.jpg", image_credit: "File:A.jpg, CC BY-SA 4.0, Wikimedia Commons" },
  { id: "d2", name: "Samosa (2 pieces)", price_paise: 6050, image_url: "https://img.test/b.jpg", image_credit: "File:B.jpg, CC0, Wikimedia Commons" },
];
const ORDER = { id: "0f0f0f0f-1111-4222-8333-444444444444", status: "placed", total_paise: 38050 };

type Net = { orders: { headers: Record<string, string>; body: any }[]; menuUp: boolean; orderReply: { status: number; body: unknown } };

async function mockNetwork(context: BrowserContext): Promise<Net> {
  await context.addInitScript(() => { try { window.localStorage.setItem("gs-pin", "110016"); } catch { /* blocked */ } });   // story B2: this device already knows its pin code
  const net: Net = { orders: [], menuUp: true, orderReply: { status: 201, body: { ok: true, created: true, order: ORDER } } };
  const reply = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes("/auth/v1/signup")) {
      return reply(route, 200, { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (req.url().includes("/rest/v1/kitchens")) return reply(route, 200, [{ id: "k-1", name: "Hauz Khas Kitchen", pin_codes: ["110016"], lat: null, lng: null, open: true, active: true }]);
    if (req.url().includes("/rest/v1/menu_items")) return net.menuUp ? reply(route, 200, MENU) : route.abort("internetdisconnected");
    return reply(route, 404, {});
  });
  await context.route("https://orders.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    net.orders.push({ headers: req.headers(), body: JSON.parse(req.postData() ?? "{}") });
    return reply(route, net.orderReply.status, net.orderReply.body);
  });
  await context.route("https://img.test/**", (route) => route.abort());
  return net;
}

test("S1 order path: add 2 dishes, see the bill, place the order (cash on delivery)", async ({ page, context }) => {
  const net = await mockNetwork(context);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Screen" })).toBeVisible();
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(page.getByText("₹320", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: "Add Samosa (2 pieces)" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();

  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await page.getByLabel("Address").fill("Flat 4, Green Park, Delhi");

  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByTestId("bill-total")).toHaveText("₹380.50");
  await page.getByRole("button", { name: /Place order/ }).click();

  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByText("₹380.50")).toBeVisible();
  expect(net.orders).toHaveLength(1);
  expect(net.orders[0].headers["x-gs-token"]).toBe("demo-token");
  expect(net.orders[0].body).toMatchObject({
    action: "place", session_id: SESSION, address: "Flat 4, Green Park, Delhi",
    items: [{ menu_item_id: "d1", qty: 1 }, { menu_item_id: "d2", qty: 1 }],
  });
  expect(net.orders[0].body.client_order_key).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.stringify(net.orders[0].body)).not.toMatch(/price|total/);   // the server prices the order
});

test("S1 the address is required before the bill", async ({ page, context }) => {
  await mockNetwork(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  await page.getByLabel("Address").fill("Flat 4");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("S1 quantity buttons change the bill", async ({ page, context }) => {
  await mockNetwork(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Add Samosa (2 pieces)" }).click();
  await page.getByRole("button", { name: "More Samosa (2 pieces)" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("x");
  await expect(page.getByTestId("bill-total")).toHaveText("₹121");
});

test("S1 a refused order shows the reason, and the retry sends the same order key", async ({ page, context }) => {
  const net = await mockNetwork(context);
  net.orderReply = { status: 503, body: { ok: false, error: "kill_switch", message: "Orders are paused. Please try again soon." } };
  await page.goto("/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Orders are paused. Please try again soon.");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();

  net.orderReply = { status: 200, body: { ok: true, created: false, order: ORDER } };
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.orders).toHaveLength(2);
  expect(net.orders[1].body.client_order_key).toBe(net.orders[0].body.client_order_key);
});

test("S2 the menu still shows with the network off, after it was loaded once", async ({ page, context }) => {
  const net = await mockNetwork(context);
  await page.goto("/");
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  net.menuUp = false;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(page.getByText("₹60.50")).toBeVisible();
  await expect(page.getByText("Showing the saved menu")).toBeVisible();
});

test("S2 with no network and no saved menu, the screen says so instead of staying blank", async ({ page, context }) => {
  const net = await mockNetwork(context);
  net.menuUp = false;
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText("The menu is not available. Connect once to load it.");
});

test("S3 after a refresh the customer lands back on the order that is still open", async ({ page, context }) => {
  await mockNetwork(context);
  const row = { ...ORDER, session_id: SESSION, address: "Flat 4, Delhi", items: [{ name: "Butter Chicken", qty: 1, price_paise: 32000, menu_item_id: "d1" }], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), paid_by: null };
  await context.route("https://test.supabase.co/rest/v1/orders**", (route) =>
    route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify([row]) }));
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByText("Butter Chicken").or(page.getByText("₹380.50")).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("0f0f0f0f-1111");   // D2: never the whole order id on a customer screen (the short number is allowed)
});

test("S3 a delivered order does not pull the customer back from the menu", async ({ page, context }) => {
  await mockNetwork(context);
  const row = { ...ORDER, status: "delivered", session_id: SESSION, address: "x", items: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), paid_by: "cash" };
  await context.route("https://test.supabase.co/rest/v1/orders**", (route) =>
    route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify([row]) }));
  await page.goto("/customer/");
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order placed" })).toHaveCount(0);
});
