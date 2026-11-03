// Story H7 (#190): the admin Simulator tab talks to n8n GS MAIN 30 (webhook gs-sim) with the simulator token, never to the database.
import { describe, expect, it, vi } from "vitest";
import { CLEAR_WORD, KNOB_DEFAULTS, SEED_DEFAULTS, callSim, clearAll, clearShown, groupLine, SimError, tickLine } from "../../src/lib/sim";

const deps = (res: () => Promise<Response>, seen: { url?: string; init?: RequestInit } = {}) => ({
  url: "https://n8n.test/webhook/gs-sim", token: "sim-token",
  fetchFn: (async (url: string, init: RequestInit) => { seen.url = url; seen.init = init; return res(); }) as typeof fetch,
});
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("callSim", () => {
  it("posts the action and the parameters with the simulator token header", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const a = await callSim("seed", { kitchens: 12, riders: 20, dishes_per_kitchen: 6, seed: 42 }, deps(json(200, { ok: true, kitchens: 12, riders: 20, dishes: 72 }), seen));
    expect(seen.url).toBe("https://n8n.test/webhook/gs-sim");
    expect((seen.init?.headers as Record<string, string>)["x-gs-sim-token"]).toBe("sim-token");
    expect((seen.init?.headers as Record<string, string>)["x-gs-token"]).toBeUndefined();
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "seed", kitchens: 12, riders: 20, dishes_per_kitchen: 6, seed: 42 });
    expect(a).toEqual({ ok: true, kitchens: 12, riders: 20, dishes: 72 });
  });
  it("turns a refusal into its message and code, and a dead network into a plain line", async () => {
    await expect(callSim("reset", {}, deps(json(503, { ok: false, error: "kill_switch", message: "The simulator is paused." })))).rejects.toMatchObject({ message: "The simulator is paused.", code: "kill_switch" });
    await expect(callSim("status", {}, deps(async () => { throw new Error("down"); }))).rejects.toBeInstanceOf(SimError);
    await expect(callSim("status", {}, deps(async () => { throw new Error("down"); }))).rejects.toMatchObject({ message: "No internet. Check your internet and try again.", code: "network" });
    await expect(callSim("tick", {}, deps(json(500, "<html>")))).rejects.toMatchObject({ code: "unknown" });
  });
});

describe("the #284 numbers", () => {
  it("the seed has two choices and the knobs start where the database starts", () => {
    expect(SEED_DEFAULTS).toEqual({ riders_per_kitchen: 4, online_pct: 70 });
    expect(KNOB_DEFAULTS).toEqual({ reject_pct: 5, sold_out_pct: 3, delay_pct: 10, rider_drop_pct: 2 });
  });
  it("the tick line says what the orders did", () => {
    expect(tickLine({ ok: true, riders_moved: 3, orders: { accepted: 2, cancelled: 1, delivered: 1, dropped: 0 } })).toContain("Orders: 2 accepted, 1 turned away, 1 delivered, 0 riders dropped.");
    expect(tickLine({ ok: true, riders_moved: 3 })).not.toContain("Orders:");
  });
});

// Story #848 (board A-Sim-Groups, A-Sim-Clear): two seed groups, and Clear everything through the admin's own session.
describe("the two seed groups", () => {
  it("seed_kitchens and seed_riders go to the webhook with the simulator token", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    await callSim("seed_kitchens", {}, deps(json(200, { ok: true, kitchens: 10 }), seen));
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "seed_kitchens" });
    await callSim("seed_riders", { riders_per_kitchen: 3, online_pct: 70 }, deps(json(200, { ok: true, riders: 30 }), seen));
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "seed_riders", riders_per_kitchen: 3, online_pct: 70 });
  });
  it("a group line says how many are synthetic and how many are real", () => {
    expect(groupLine(10, 6)).toBe("10 synthetic · 6 real");
    expect(groupLine(undefined, undefined)).toBe("0 synthetic · 0 real");
  });
});

describe("Clear everything", () => {
  it("is the typed word CLEAR", () => expect(CLEAR_WORD).toBe("CLEAR"));
  it("shows only when the dev build flag is on AND the database says it is allowed", () => {
    expect(clearShown("1", { ok: true, clear_allowed: true })).toBe(true);
    expect(clearShown("1", { ok: true, clear_allowed: false })).toBe(false);
    expect(clearShown("1", { ok: true })).toBe(false);
    expect(clearShown(undefined, { ok: true, clear_allowed: true })).toBe(false);
    expect(clearShown("1", null)).toBe(false);
  });
  it("calls the sim_clear_all function with the admin's client, never the webhook, and returns the counts", async () => {
    const calls: string[] = [];
    const c = { rpc: async (name: string) => { calls.push(name); return { data: { ok: true, kitchens: 16, riders: 33, dishes: 120, orders: 41 }, error: null }; } };
    expect(await clearAll(c as never)).toEqual({ ok: true, kitchens: 16, riders: 33, dishes: 120, orders: 41 });
    expect(calls).toEqual(["sim_clear_all"]);
  });
  it("turns a refusal into a plain line", async () => {
    const off = { rpc: async () => ({ data: { ok: false, error: "clear_not_allowed", message: "Clear everything is switched off on this database." }, error: null }) };
    await expect(clearAll(off as never)).rejects.toMatchObject({ message: "Clear everything is switched off on this database.", code: "clear_not_allowed" });
    const nobody = { rpc: async () => ({ data: null, error: { message: "not_admin" } }) };
    await expect(clearAll(nobody as never)).rejects.toMatchObject({ message: "Only an admin can clear the city.", code: "not_admin" });
    const down = { rpc: async () => ({ data: null, error: { message: "fetch failed" } }) };
    await expect(clearAll(down as never)).rejects.toMatchObject({ code: "unknown" });
  });
  // Story #869: an admin reads the true reason when the call fails, and the full error goes to the console.
  it("shows the message and the code of the database error, and keeps the plain line for not_admin", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const jwt = { message: "JWT expired", code: "PGRST301", details: null, hint: null };
    await expect(clearAll({ rpc: async () => ({ data: null, error: jwt }) } as never)).rejects.toMatchObject({ message: "JWT expired (PGRST301)", code: "PGRST301" });
    expect(spy).toHaveBeenCalledWith("sim_clear_all failed", jwt);
    await expect(clearAll({ rpc: async () => ({ data: null, error: { message: "TypeError: Failed to fetch" } }) } as never)).rejects.toMatchObject({ message: "TypeError: Failed to fetch", code: "unknown" });
    await expect(clearAll({ rpc: async () => ({ data: null, error: { message: "not_admin", code: "42501" } }) } as never)).rejects.toMatchObject({ message: "Only an admin can clear the city.", code: "not_admin" });
    await expect(clearAll({ rpc: async () => ({ data: null, error: { message: "", code: "" } }) } as never)).rejects.toMatchObject({ message: "Something went wrong. Please try again." });
    spy.mockRestore();
  });
});
