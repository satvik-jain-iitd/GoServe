// Story #83: the customer, kitchen, rider and ops apps are separate installable apps on one origin. The network is answered by the test.
import { test, expect } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

test("S2 the kitchen app shows only the kitchen: no role tabs, no demo tools, its own title", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";   // H3: the kitchen app is for kitchen staff
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Kitchen", exact: true })).toBeVisible();
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Screen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset demo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Autopilot" })).toHaveCount(0);
  await expect(page).toHaveTitle("GoServe Kitchen");
});

test("S2 the rider app, the ops app and the customer app each open on their own screen", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.admin = true;   // the Ops app is for admins only (story A4)
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();   // H11: the Job tab with a delivery in hand
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeVisible();
  await expect(page).toHaveTitle("GoServe Rider");
  await page.goto("/ops/");
  await expect(page.getByRole("heading", { name: "Ops", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("GoServe Ops");
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Your order", exact: true })).toBeVisible();   // the session has an open order, so the customer app resumes it
  await expect(page.getByRole("navigation", { name: "Screen" })).toHaveCount(0);
  await expect(page).toHaveTitle("GoServe");
});

test("S2 the demo console at / is unchanged: five tabs and the demo tools", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  for (const name of ["Customer", "Kitchen", "Rider", "Split", "Ops"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
});

test("S2 each app points to its own manifest, with its own name, install identity and scope", async ({ page, context }) => {
  await setup(context, page);
  for (const [path, role, name] of [["/kitchen/", "kitchen", "GoServe Kitchen"], ["/rider/", "rider", "GoServe Rider"], ["/ops/", "ops", "GoServe Ops"], ["/customer/", "customer", "GoServe"], ["/admin/", "admin", "GoServe Admin"]]) {
    await page.goto(path);
    const href = await page.locator("link[rel=manifest]").getAttribute("href");
    expect(href).toBe(`/manifests/${role}.webmanifest`);
    const m = await page.evaluate(async (h) => (await fetch(h!)).json(), href);
    expect(m).toMatchObject({ name, id: `/${role}/`, scope: `/${role}/`, start_url: `/${role}/` });
  }
});

test("S1 one device: the customer app and the kitchen app share one session, with no sign-in twice and no link", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";   // H3: the kitchen app is for kitchen staff
  await page.goto("/customer/");   // the session already holds this open order, so the customer app resumes on it
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.calls.signups).toBe(1);
  const kitchen = await context.newPage();   // a second app window on the same device (same browser profile)
  await kitchen.goto("/kitchen/");
  await expect(kitchen.getByText("Order 0f0f0f0f")).toBeVisible();
  const rider = await context.newPage();
  await rider.goto("/rider/");
  await expect(rider.getByRole("heading", { name: "Deliveries", exact: true })).toBeVisible();   // H11: no delivery in hand yet
  expect(net.calls.signups).toBe(1);   // the kitchen app and the rider app reused the customer app's session
  expect(net.calls.orderReads.filter((u) => u.includes(`session_id=eq.${SESSION}`)).length).toBeGreaterThanOrEqual(1);   // the customer app reads its session; the kitchen app reads its kitchen
  expect(net.calls.orderReads.some((u) => u.includes("kitchen_id=eq.k-1"))).toBe(true);
});

test("S1 one device: a tap in the kitchen app reaches the order the customer app placed", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";   // H3: the kitchen app is for kitchen staff
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  expect(net.calls.status[0].body).toMatchObject({ order_id: ID, session_id: SESSION, to_status: "accepted", actor: "kitchen" });
});

test("S3 a link on the kitchen address still joins the session, but gives a non-staff account no kitchen access (H3)", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  const OTHER = "7e57ab1e-0000-4000-8000-0000000000b2";
  await page.goto(`/kitchen/?join=${OTHER}`);
  await expect(page.getByText("This account is not kitchen staff. Ask the admin.")).toBeVisible();
  await expect(page.getByText("Order 0f0f0f0f")).toHaveCount(0);
  expect(net.calls.rpc).toContainEqual({ name: "join_session", body: { p_session: OTHER } });
  expect(page.url()).not.toContain("join=");   // the link is tidied away, and the address stays on the kitchen app
  expect(new URL(page.url()).pathname).toBe("/kitchen/");
});

// The install bug of 22 Oct 2026: Add to Home Screen opened the domain, not /customer/. Chrome reads the manifest from the first HTML it gets,
// so every role page must already carry its own manifest link before any script runs. These tests read the raw HTML, as the browser first sees it.
test("S2 the first HTML of each role page already links its own manifest and title (no script needed)", async ({ request }) => {
  for (const [path, role, title] of [["/customer/", "customer", "GoServe"], ["/kitchen/", "kitchen", "GoServe Kitchen"], ["/rider/", "rider", "GoServe Rider"], ["/ops/", "ops", "GoServe Ops"], ["/admin/", "admin", "GoServe Admin"]]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain(`href="/manifests/${role}.webmanifest"`);
    expect(html, path).not.toContain('href="/manifest.webmanifest"');   // the default manifest would install the domain
    expect(html, path).toContain(`<title>${title}</title>`);
    const manifest = await (await request.get(`/manifests/${role}.webmanifest`)).json();
    expect([manifest.start_url, manifest.scope, manifest.id]).toEqual([`/${role}/`, `/${role}/`, `/${role}/`]);
  }
});

test("S2 the root page keeps the default manifest (the demo console)", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain('href="/manifest.webmanifest"');
  expect(html).not.toContain("/manifests/");
});

test("S2 once the service worker is in charge, a role page still gets its own manifest link (not the default page)", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/kitchen/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();   // this load is answered by the service worker
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.locator("link[rel=manifest]").getAttribute("href")).toBe("/manifests/kitchen.webmanifest");
  await page.goto("/customer/");
  expect(await page.locator("link[rel=manifest]").getAttribute("href")).toBe("/manifests/customer.webmanifest");
});

test("S2 each role page uses its own tab icon and iPhone home-screen icon", async ({ request }) => {
  for (const role of ["customer", "kitchen", "rider", "ops", "admin"]) {
    const html = await (await request.get(`/${role}/`)).text();
    expect(html, role).toContain(`<link rel="apple-touch-icon" href="/icons/${role}-192.png"`);
    expect(html, role).toContain(`<link rel="icon" href="/icons/${role}-192.png"`);
    expect((await request.get(`/icons/${role}-192.png`)).status(), role).toBe(200);
  }
});
