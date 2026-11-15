// Story #590: the customer app places the order with POST /orders (backend v2) as the only way to place (story #940). No network: fetch is injected.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { placeOrderV2 as send, PriceChanged, type PlaceV2Input, type V2Deps } from "../../src/lib/ordersV2";
import { PlaceError } from "../../src/lib/orders";

const input = { kitchenId: "k-1", pin: "110016", items: [{ menu_item_id: "d1", qty: 2 }], address: " Flat 4, Green Park ", key: "key-12345678", expectedPaise: 29000, code: null as string | null, none: false };
const placeOrderV2 = (i: Omit<PlaceV2Input, "drop">, d: V2Deps) => send({ ...i, drop: { lat: 28.5677, lng: 77.2432 } }, d);   // story 1528: every order has a point
const deps = (status: number, body: unknown, token = "tok") => {
  const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { fetchFn: fetchFn as unknown as typeof fetch, token: async () => token, url: "https://x.supabase.co", anon: "anon" };
};
const placed = { ok: true, created: true, order: { id: "o1", kitchen_id: "k-1", status: "placed", total_paise: 29000, address: "Flat 4", items: [], bill: {}, created_at: "2026-10-29T10:00:00Z" } };

describe("placeOrderV2", () => {
  it("S2 posts the cart, the address, the key and the price the customer saw, with the caller's token", async () => {
    const d = deps(201, placed);
    const r = await placeOrderV2(input, d);
    const [url, init] = (d.fetchFn as any).mock.calls[0];
    expect(url).toBe("https://x.supabase.co/functions/v1/orders");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(init.headers.apikey).toBe("anon");
    expect(JSON.parse(init.body)).toEqual({ kitchen_id: "k-1", lines: [{ menu_item_id: "d1", qty: 2, option_ids: [] }], address: { pin_code: "110016", text: "Flat 4, Green Park", lat: 28.5677, lng: 77.2432 },
      idempotency_key: "key-12345678", expected_to_pay_paise: 29000 });
    expect(r.order).toMatchObject({ id: "o1", status: "placed", total_paise: 29000, updated_at: "2026-10-29T10:00:00Z" });
    expect(r.created).toBe(true);
  });

  it("S3 a chosen coupon or Remove goes with the order, so the server re-prices the same way", async () => {
    const a = deps(201, placed);
    await placeOrderV2({ ...input, code: "FLAT50" }, a);
    expect(JSON.parse((a.fetchFn as any).mock.calls[0][1].body)).toMatchObject({ coupon_code: "FLAT50" });
    const b = deps(201, placed);
    await placeOrderV2({ ...input, none: true }, b);
    expect(JSON.parse((b.fetchFn as any).mock.calls[0][1].body)).toMatchObject({ no_coupon: true });
  });

  it("S4 409 price_changed throws PriceChanged with the new quote", async () => {
    const quote = { ok: true, to_pay_paise: 30000, item_total_paise: 26000, fees: { delivery_paise: 4000, packaging_paise: 0, total_paise: 4000 }, discount_paise: 0, coupon: null, tax_paise: 0, tax_mode: "inclusive", offers: [] };
    const err = await placeOrderV2(input, deps(409, { ok: false, error: "price_changed", message: "A price changed. Check the bill again.", quote })).catch((e) => e);
    expect(err).toBeInstanceOf(PriceChanged);
    expect(err.quote.to_pay_paise).toBe(30000);
  });

  it("S5 422 and the rest show our lines, never the server's words", async () => {
    const closed = await placeOrderV2(input, deps(422, { ok: false, error: "kitchen_closed", message: "secret server text" })).catch((e) => e);
    expect(closed).toBeInstanceOf(PlaceError);
    expect(closed.message).toBe("The kitchen closed just now. Check back later.");
    const odd = await placeOrderV2(input, deps(502, { ok: false, error: "order_unavailable" })).catch((e) => e);
    expect(odd.message).toBe("We could not place your order. Nothing was charged. Try again in a minute.");
    const noBody = await placeOrderV2(input, { ...deps(401, {}), fetchFn: (async () => new Response("no", { status: 401 })) as unknown as typeof fetch }).catch((e) => e);   // story 1580: a 401 with no code still gets its own line
    expect(noBody.message).toBe("Your sign-in ended. Sign in again to place your order.");
    const net = await placeOrderV2(input, { ...deps(200, {}), fetchFn: (async () => { throw new Error("down"); }) as unknown as typeof fetch }).catch((e) => e);
    expect(net.message).toBe("No internet. Check your internet and try again.");
  });

  it("S6 the same key answers the same order (created false, 200)", async () => {
    const r = await placeOrderV2(input, deps(200, { ...placed, created: false }));
    expect(r.created).toBe(false);
  });
});

describe("the switch", () => {
  it("S7 no deploy workflow sets VITE_ORDERS_V2 (off until the switch)", () => {
    for (const f of ["deploy-app.yml", "deploy-dev.yml", "deploy.yml"]) {
      expect(readFileSync(join(__dirname, "../../../.github/workflows", f), "utf8")).not.toContain("VITE_ORDERS_V2");
    }
  });
});

// Story 1580: a 401 asks the app to renew the sign-in once and retries once with the same key. The renewal is the caller's (it may need saveProfile again), so this function only asks.
describe("placeOrderV2 on a 401 (story 1580)", () => {
  const SIGN_IN = "Your sign-in ended. Sign in again to place your order.";
  const seq = (renew: (() => Promise<boolean>) | undefined, ...answers: [number, unknown][]) => {
    const fetchFn = vi.fn(async () => { const [st, b] = answers.shift()!; return new Response(JSON.stringify(b), { status: st, headers: { "content-type": "application/json" } }); });
    return { fetchFn: fetchFn as unknown as typeof fetch, token: async () => "user-tok", url: "https://x.supabase.co", anon: "anon", renew, calls: fetchFn.mock.calls as unknown as [string, RequestInit][] };
  };
  it("a renewed sign-in retries once with the same key and places one order", async () => {
    const renew = vi.fn(async () => true);
    const d = seq(renew, [401, { ok: false, error: "unauthorized" }], [201, placed]);
    const r = await placeOrderV2(input, d);
    expect(r.order.id).toBe("o1");
    expect(renew).toHaveBeenCalledTimes(1);
    expect(d.calls).toHaveLength(2);
    expect(JSON.parse(d.calls[1][1].body as string).idempotency_key).toBe("key-12345678");
  });
  it("a sign-in that could not be renewed sends no second request and shows the sign-in line", async () => {
    const d = seq(async () => false, [401, { ok: false, error: "unauthorized" }]);
    const err = await placeOrderV2(input, d).catch((e) => e);
    expect(err.message).toBe(SIGN_IN);
    expect(d.calls).toHaveLength(1);
  });
  it("two 401s show the sign-in line after exactly two requests", async () => {
    const d = seq(async () => true, [401, { ok: false, error: "unauthorized" }], [401, { ok: false, error: "unauthorized" }]);
    const err = await placeOrderV2(input, d).catch((e) => e);
    expect(err.message).toBe(SIGN_IN);
    expect(d.calls).toHaveLength(2);
  });
  it("with no renew given, a 401 is one request and the line", async () => {
    const d = seq(undefined, [401, { ok: false, error: "unauthorized" }]);
    expect((await placeOrderV2(input, d).catch((e) => e)).message).toBe(SIGN_IN);
    expect(d.calls).toHaveLength(1);
  });
});

// Story 1580: which token each caller gets. Search and map calls never make a guest; only Place order signs in first.
describe("tokens (story 1580)", () => {
  const load = async (session: { access_token: string; user: { id: string; is_anonymous: boolean } } | null, refresh: { data?: { session: unknown }; error: { name: string } | null }) => {
    vi.resetModules();
    const ensure = vi.fn(async () => { session = { access_token: "made-tok", user: { id: "u2", is_anonymous: true } }; return "u2"; });
    const signOut = vi.fn(async () => ({ error: null }));
    vi.doMock("../../src/lib/supabase", () => ({ ensureSession: ensure, getClient: () => ({ auth: { getSession: async () => ({ data: { session } }), refreshSession: async () => refresh, signOut } }) }));
    const mod = await import("../../src/lib/ordersV2");
    return { ...mod, ensure, signOut };
  };
  it("the search token never makes a guest: with no session it is the anon key and ensureSession is not called", async () => {
    vi.stubGlobal("window", globalThis);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-x");
    const { v2Deps, ensure } = await load(null, { error: null });
    expect(await v2Deps().token()).toBe("anon-x");
    expect(ensure).not.toHaveBeenCalled();
  });
  it("the Place order token signs in first when the phone has no session", async () => {
    const { userToken, ensure } = await load(null, { error: null });
    expect(await userToken()).toBe("made-tok");
    expect(ensure).toHaveBeenCalled();
  });
  it("renew: a refresh that keeps the same user is renewed, nothing is signed out", async () => {
    const s = { access_token: "a", user: { id: "u1", is_anonymous: false } };
    const { renewSession, signOut } = await load(s, { data: { session: { user: { id: "u1" } } }, error: null });
    expect(await renewSession()).toBe("same");
    expect(signOut).not.toHaveBeenCalled();
  });
  it("renew: a refused refresh for a phone user makes no guest and signs nobody out", async () => {
    const s = { access_token: "a", user: { id: "u1", is_anonymous: false } };
    const { renewSession, signOut, ensure } = await load(s, { error: { name: "AuthApiError" } });
    expect(await renewSession()).toBe("gone");
    expect(signOut).not.toHaveBeenCalled();
    expect(ensure).not.toHaveBeenCalled();
  });
  it("renew: a refused refresh for a guest makes a new guest (the caller then saves the profile again)", async () => {
    const s = { access_token: "a", user: { id: "u1", is_anonymous: true } };
    const { renewSession, signOut, ensure } = await load(s, { error: { name: "AuthApiError" } });
    expect(await renewSession()).toBe("guest");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(ensure).toHaveBeenCalled();
  });
  it("renew: a dead network changes nothing", async () => {
    const s = { access_token: "a", user: { id: "u1", is_anonymous: true } };
    const { renewSession, signOut } = await load(s, { error: { name: "AuthRetryableFetchError" } });
    expect(await renewSession()).toBe("gone");
    expect(signOut).not.toHaveBeenCalled();
  });
});
