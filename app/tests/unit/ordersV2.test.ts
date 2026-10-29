// Story #590: the customer app places the order with POST /orders (backend v2) behind VITE_ORDERS_V2=1. No network: fetch is injected.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ordersV2On, placeOrderV2, PriceChanged } from "../../src/lib/ordersV2";
import { PlaceError } from "../../src/lib/orders";

const input = { kitchenId: "k-1", pin: "110016", items: [{ menu_item_id: "d1", qty: 2 }], address: " Flat 4, Green Park ", key: "key-12345678", expectedPaise: 29000, code: null as string | null, none: false };
const deps = (status: number, body: unknown, token = "tok") => {
  const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { fetchFn: fetchFn as unknown as typeof fetch, token: async () => token, url: "https://x.supabase.co", anon: "anon" };
};
const placed = { ok: true, created: true, order: { id: "o1", kitchen_id: "k-1", status: "placed", total_paise: 29000, address: "Flat 4", items: [], bill: {}, created_at: "2026-10-29T10:00:00Z" } };

describe("ordersV2On", () => {
  it("S1 off by default; on by the build flag or by this phone's own flag", () => {
    expect(ordersV2On({})).toBe(false);
    expect(ordersV2On({ VITE_ORDERS_V2: "1" })).toBe(true);
    expect(ordersV2On({}, { getItem: () => "1" })).toBe(true);
    expect(ordersV2On({}, { getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
});

describe("placeOrderV2", () => {
  it("S2 posts the cart, the address, the key and the price the customer saw, with the caller's token", async () => {
    const d = deps(201, placed);
    const r = await placeOrderV2(input, d);
    const [url, init] = (d.fetchFn as any).mock.calls[0];
    expect(url).toBe("https://x.supabase.co/functions/v1/orders");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(init.headers.apikey).toBe("anon");
    expect(JSON.parse(init.body)).toEqual({ kitchen_id: "k-1", lines: [{ menu_item_id: "d1", qty: 2, option_ids: [] }], address: { pin_code: "110016", text: "Flat 4, Green Park" },
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
    expect(odd.message).toBe("Something went wrong. Please try again.");
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
