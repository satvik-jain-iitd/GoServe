// Story #48, S1: placing an order calls the n8n webhook (ADR-009) with the demo token. The server prices the order.
import { describe, expect, it } from "vitest";
import { placeOrder, PlaceError } from "../../src/lib/orders";

const input = { sessionId: "s1", key: "k1", items: [{ menu_item_id: "a", qty: 2 }], address: "Flat 4, Delhi" };
const deps = (res: () => Promise<Response>, seen: { url?: string; init?: RequestInit } = {}) => ({
  url: "https://n8n.test/webhook/gs-order",
  token: "demo-token",
  fetchFn: (async (url: string, init: RequestInit) => { seen.url = url; seen.init = init; return res(); }) as typeof fetch,
});
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("placeOrder", () => {
  it("posts the action, session, key, items and address with the token header", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    await placeOrder(input, deps(json(201, { ok: true, created: true, order: { id: "o1", total_paise: 44100, status: "placed" } }), seen));
    expect(seen.url).toBe("https://n8n.test/webhook/gs-order");
    expect(seen.init?.method).toBe("POST");
    expect((seen.init?.headers as Record<string, string>)["x-gs-token"]).toBe("demo-token");
    expect(JSON.parse(seen.init?.body as string)).toEqual({
      action: "place", session_id: "s1", client_order_key: "k1", items: [{ menu_item_id: "a", qty: 2 }], address: "Flat 4, Delhi",
    });
  });

  it("returns the saved order (201 new, 200 retry)", async () => {
    const order = { id: "o1", total_paise: 44100, status: "placed" };
    expect(await placeOrder(input, deps(json(201, { ok: true, created: true, order })))).toEqual({ order, created: true });
    expect(await placeOrder(input, deps(json(200, { ok: true, created: false, order })))).toEqual({ order, created: false });
  });

  it("turns a refusal into a message the customer can read", async () => {
    await expect(placeOrder(input, deps(json(503, { ok: false, error: "kill_switch", message: "Orders are paused. Please try again soon." }))))
      .rejects.toMatchObject({ message: "Orders are paused. Please try again soon.", code: "kill_switch" });
    await expect(placeOrder(input, deps(json(429, { ok: false, error: "session_order_cap", message: "Too many orders in this demo session." }))))
      .rejects.toBeInstanceOf(PlaceError);
  });

  it("explains a network failure in plain words", async () => {
    await expect(placeOrder(input, deps(async () => { throw new TypeError("Failed to fetch"); })))
      .rejects.toMatchObject({ message: "No network. Check your connection and try again.", code: "network" });
  });

  it("does not show raw server text when the answer is not the expected shape", async () => {
    await expect(placeOrder(input, deps(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }))))
      .rejects.toMatchObject({ message: "Something went wrong. Please try again.", code: "unknown" });
    await expect(placeOrder(input, deps(json(200, { ok: true }))))
      .rejects.toMatchObject({ code: "unknown" });
  });
});
