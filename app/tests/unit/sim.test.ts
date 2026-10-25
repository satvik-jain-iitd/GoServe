// Story H7 (#190): the admin Simulator tab talks to n8n GS MAIN 30 (webhook gs-sim) with the simulator token, never to the database.
import { describe, expect, it } from "vitest";
import { callSim, SimError } from "../../src/lib/sim";

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
    await expect(callSim("status", {}, deps(async () => { throw new Error("down"); }))).rejects.toMatchObject({ message: "No network. Check your connection and try again.", code: "network" });
    await expect(callSim("tick", {}, deps(json(500, "<html>")))).rejects.toMatchObject({ code: "unknown" });
  });
});
