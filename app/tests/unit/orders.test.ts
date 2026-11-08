// Story #940: every step after "placed" goes to POST /order-actions with the signed-in user's own token. The body names the order and the step only.
// askDecision asks the database (story #1068).
import { describe, expect, it } from "vitest";
import { addEvent, askDecision, changeStatus, confirmDelivery, PlaceError } from "../../src/lib/orders";

const deps = (res: () => Promise<Response>, seen: { url?: string; init?: RequestInit } = {}) => ({
  url: "https://n8n.test/webhook/gs-order",
  token: "demo-token",
  fetchFn: (async (url: string, init: RequestInit) => { seen.url = url; seen.init = init; return res(); }) as typeof fetch,
});
const act = (res: () => Promise<Response>, seen: { url?: string; init?: RequestInit } = {}) => ({
  url: "https://x.supabase.co", anon: "anon-key", token: async () => "user-jwt",
  fetchFn: (async (url: string, init: RequestInit) => { seen.url = url; seen.init = init; return res(); }) as typeof fetch,
});
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("changeStatus", () => {
  const change = { orderId: "o1", to: "accepted" };
  it("S1 posts the order and the step to order-actions with the user's own token, and nothing about who is asking", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const order = { id: "o1", total_paise: 100, status: "accepted" };
    expect(await changeStatus(change, act(json(200, { ok: true, order }), seen))).toEqual({ order });
    expect(seen.url).toBe("https://x.supabase.co/functions/v1/order-actions");
    expect(JSON.parse(seen.init?.body as string)).toEqual({ order_id: "o1", action: "accept" });
    const h = seen.init?.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer user-jwt");
    expect(h.apikey).toBe("anon-key");
    expect(h["x-gs-token"]).toBeUndefined();
  });
  it("S2 each status maps to its step", async () => {
    const steps: Record<string, string> = { accepted: "accept", preparing: "prepare", ready: "ready", out_for_delivery: "pickup", delivered: "deliver" };
    for (const [to, action] of Object.entries(steps)) {
      const seen: { init?: RequestInit } = {};
      await changeStatus({ orderId: "o1", to }, act(json(200, { ok: true, order: { id: "o1" } }), seen));
      expect(JSON.parse(seen.init?.body as string).action).toBe(action);
    }
  });
  it("S3 a status that has no step is refused before anything is sent", async () => {
    const seen: { url?: string } = {};
    await expect(changeStatus({ orderId: "o1", to: "teleported" }, act(json(200, {}), seen))).rejects.toMatchObject({ code: "unknown" });
    expect(seen.url).toBeUndefined();
  });
  it("S4 the wrong user is refused with the server's line", async () => {
    await expect(changeStatus(change, act(json(403, { ok: false, error: "not_allowed", message: "You cannot do this step on this order." }))))
      .rejects.toMatchObject({ message: "You cannot do this step on this order.", code: "not_allowed" });
  });
  it("shows the server reason for an illegal step", async () => {
    await expect(changeStatus(change, act(json(409, { ok: false, error: "illegal_step", message: "The order is not at the step before this one." }))))
      .rejects.toMatchObject({ code: "illegal_step" });
  });
  it("explains a network failure in plain words", async () => {
    await expect(changeStatus(change, act(async () => { throw new TypeError("x"); }))).rejects.toMatchObject({ code: "network" });
  });
});

describe("addEvent", () => {
  it("posts the arriving step for the rider's tap", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const order = { id: "o1", total_paise: 100, status: "out_for_delivery", updated_at: "t" };
    expect(await addEvent({ orderId: "o1", event: "order.arriving" }, act(json(200, { ok: true, order }), seen))).toEqual({ order });
    expect(JSON.parse(seen.init?.body as string)).toEqual({ order_id: "o1", action: "arriving" });
  });
  it("a second tap is code already_done", async () => {
    await expect(addEvent({ orderId: "o1", event: "order.arriving" }, act(json(409, { ok: false, error: "already_done", message: "This step was already done." }))))
      .rejects.toMatchObject({ code: "already_done" });
  });
});

describe("confirmDelivery", () => {
  const order = { id: "o1", status: "delivered", total_paise: 100, updated_at: "u", paid_by: "cash" };
  it("S5 Yes posts the confirm step with the user's token and returns the closed order", async () => {
    const seen: { init?: RequestInit } = {};
    expect(await confirmDelivery({ orderId: "o1" }, act(json(200, { ok: true, order }), seen))).toEqual({ order, alreadyDone: false });
    expect(JSON.parse(seen.init?.body as string)).toEqual({ order_id: "o1", action: "confirm" });
    expect((seen.init?.headers as Record<string, string>).authorization).toBe("Bearer user-jwt");
  });
  it("S6 a second Yes is not an error", async () => {
    expect((await confirmDelivery({ orderId: "o1" }, act(json(409, { ok: false, error: "already_done", message: "x" })))).alreadyDone).toBe(true);
  });
  it("S7 a stranger's Yes is refused in the customer's own words", async () => {
    await expect(confirmDelivery({ orderId: "o1" }, act(json(403, { ok: false, error: "not_allowed", message: "x" })))).rejects.toBeInstanceOf(PlaceError);
  });
});

describe("askDecision", () => {
  const riders = [{ id: "r1", free: true, distance_m: 1800, trips_done: 3 }];
  const input = { sessionId: "s1", kitchenId: "k1", orderId: "o1", riders };
  const client = (reply: { data?: unknown; error?: unknown }, seen: { name?: string; args?: unknown } = {}) => ({ rpc: async (name: string, args: unknown) => { seen.name = name; seen.args = args; return { data: null, error: null, ...reply }; } }) as never;
  it("S1 asks the database function with the riders and returns the decision (story #1068: n8n is out of it)", async () => {
    const seen: { name?: string; args?: unknown } = {};
    const d = await askDecision(input, client({ data: { ok: true, decision: { rule_pick: "r1" } } }, seen));
    expect(seen).toEqual({ name: "decide_rider_rules_v2", args: { p_session: "s1", p_kitchen: "k1", p_order: "o1", p_riders: riders } });
    expect(d).toEqual({ rule_pick: "r1" });
  });
  it("S1 a refusal becomes a plain message; a reply without a decision, or an error, is not trusted", async () => {
    await expect(askDecision(input, client({ data: { ok: false, error: "not_allowed", message: "Only an admin can ask for a decision." } }))).rejects.toThrow("Only an admin can ask for a decision.");
    await expect(askDecision(input, client({ data: { ok: true } }))).rejects.toThrow("Something went wrong. Please try again.");
    await expect(askDecision(input, client({ error: { message: "db host down" } }))).rejects.toThrow("Something went wrong. Please try again.");
  });
});

