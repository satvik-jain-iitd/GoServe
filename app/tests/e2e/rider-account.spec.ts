// Story A5 (#152): the rider app. A rider goes online, shares a location while online, and sees only the orders assigned to them.
import { test, expect } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

test("S1 an offline rider goes online, and offline again", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();   // H11: R4
  expect(net.calls.riderWrites.find((w) => w.body.online === true)).toBeTruthy();
  await page.getByRole("button", { name: "Go offline" }).click();
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  expect(net.calls.riderWrites.at(-1)!.body.online).toBe(false);
});

test("S2 an account that is not a rider says so and shows no deliveries", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.rider = null;
  net.state.anonymous = false;
  await page.goto("/rider/");
  await expect(page.getByText("This Google account is not on the rider list")).toBeVisible();   // H11: R2
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toHaveCount(0);
});

test("S3 the rider app reads the orders assigned to this rider, not a session or a kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION }]);
  await page.goto("/rider/");
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeVisible();
  expect(net.calls.orderReads.some((u) => u.includes(`rider_id=eq.${SESSION}`))).toBe(true);
  expect(net.calls.orderReads.some((u) => u.includes("session_id=eq.") || u.includes("kitchen_id=eq."))).toBe(false);
  void ID;
});

test("S4 while online the rider's location is sent, first at once", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5494, longitude: 77.2001 });
  const net = await setup(context, page);
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  await expect.poll(() => net.calls.rpc.some((c) => c.name === "rider_ping")).toBe(true);   // H14: the history is kept by the rider_ping function
  expect(net.calls.rpc.find((c) => c.name === "rider_ping")!.body).toEqual({ p_lat: 28.5494, p_lng: 77.2001 });
  expect(net.calls.riderWrites.filter((w) => w.body.lat !== undefined)).toHaveLength(0);
});

test("S4b story 1686 while online with no new position, the last place is sent again every 10 seconds; offline, it stops", async ({ page, context }) => {
  await page.clock.install({ time: new Date("2026-11-19T06:30:00Z") });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5494, longitude: 77.2001 });   // one position, and none after it
  const net = await setup(context, page);
  const pings = () => net.calls.rpc.filter((c) => c.name === "rider_ping");
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  await expect.poll(() => pings().length).toBe(1);
  await page.clock.runFor(9_999);
  expect(pings()).toHaveLength(1);
  await page.clock.runFor(1_001);   // the 1 s check keeps the gap within a second of 10 s
  await expect.poll(() => pings().length).toBe(2);
  await page.clock.runFor(10_000);
  await expect.poll(() => pings().length).toBe(3);
  for (const c of pings()) expect(c.body).toEqual({ p_lat: 28.5494, p_lng: 77.2001 });
  await page.getByRole("button", { name: "Go offline" }).click();
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  const n = pings().length;
  await page.clock.runFor(30_000);
  expect(pings()).toHaveLength(n);
});

test("S4c story 1686 a lost fix stops the resend: one position, then an error with code 2, then no more pings; a new position sends again at once", async ({ page, context }) => {
  await page.clock.install({ time: new Date("2026-11-19T06:30:00Z") });
  await context.grantPermissions(["geolocation"]);
  await page.addInitScript(() => {   // Playwright cannot make a code 2 error, so a small fake watch takes its place
    let ok: (p: unknown) => void = () => {}, bad: (e: unknown) => void = () => {};
    const geo = {
      watchPosition: (s: typeof ok, e: typeof bad) => { ok = s; bad = e; return 1; },
      clearWatch: () => {},
      getCurrentPosition: () => {},
    };
    Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
    (window as unknown as Record<string, unknown>).__geo = {
      pos: (lat: number, lng: number) => ok({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() }),
      err: (code: number) => bad({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" }),
    };
  });
  const net = await setup(context, page);
  const pings = () => net.calls.rpc.filter((c) => c.name === "rider_ping");
  const geo = (f: string, ...a: number[]) => page.evaluate(([f, a]) => (window as unknown as { __geo: Record<string, (...x: number[]) => void> }).__geo[f as string](...(a as number[])), [f, a] as const);
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  await geo("pos", 28.5494, 77.2001);
  await expect.poll(() => pings().length).toBe(1);
  await geo("err", 2);
  await page.clock.runFor(30_000);
  expect(pings()).toHaveLength(1);
  await expect(page.getByRole("status").filter({ hasText: "Location band hai" })).toHaveCount(0);   // code 2 is a weak signal, not a refusal
  await geo("pos", 28.6, 77.3);
  await expect.poll(() => pings().length).toBe(2);
  expect(pings()[1].body).toEqual({ p_lat: 28.6, p_lng: 77.3 });
});

test("S5 an offline rider sends no location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5, longitude: 77.2 });
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(net.calls.riderWrites.filter((w) => w.body.lat !== undefined)).toHaveLength(0);
  expect(net.calls.rpc.filter((c) => c.name === "rider_ping")).toHaveLength(0);
});

// Story #1687 (E-TWA-1), the part a laptop can prove: a phone that sleeps freezes the page; when it wakes (the page turns visible) the rider's place is sent at once, not after a wait.
// What a laptop cannot prove: that Android Chrome keeps sending with the screen off or in the background. That is measured on the owner's phone (scripts/rider_gap.py).
test("S4d story 1687 after a 3 minute freeze, the page coming back to the front sends the place at once", async ({ page, context }) => {
  await page.clock.install({ time: new Date("2026-11-19T06:30:00Z") });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.5494, longitude: 77.2001 });
  const net = await setup(context, page);
  const pings = () => net.calls.rpc.filter((c) => c.name === "rider_ping");
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  await expect.poll(() => pings().length).toBe(1);
  await page.clock.setSystemTime(new Date("2026-11-19T06:33:00Z"));   // three minutes pass with no timer running, as in a frozen background page
  const before = pings().length;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => pings().length).toBeGreaterThan(before);
  expect(pings().at(-1)!.body).toEqual({ p_lat: 28.5494, p_lng: 77.2001 });
});
