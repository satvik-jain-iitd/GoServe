// Story #263: the admin app asks n8n GS MAIN 32 for the decision engine with the admin's own sign-in token. No build-time secret.
import { describe, expect, it } from "vitest";
import { callEngine, EngineError, ENGINES } from "../../src/lib/engine";

const deps = (res: () => Promise<Response>, seen: { url?: string; init?: RequestInit } = {}, token: string | null = "jwt.abc.def") => ({
  url: "https://n8n.test/webhook/gs-engine", getToken: async () => token,
  fetchFn: (async (url: string, init: RequestInit) => { seen.url = url; seen.init = init; return res(); }) as typeof fetch,
});
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("callEngine", () => {
  it("sends the signed-in user's token as a Bearer header and the action in the body", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const a = await callEngine("set", "jev", deps(json(200, { ok: true, engine: "jev", version: 2, by: "a@b.c", changed_at: "2026-10-25T10:00:00Z" }), seen));
    const h = seen.init?.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer jwt.abc.def");
    expect(h["x-gs-token"]).toBeUndefined();
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "set", engine: "jev" });
    expect(a).toMatchObject({ engine: "jev", version: 2 });
    await callEngine("get", undefined, deps(json(200, { ok: true, engine: "rules", version: 1 }), seen));
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "get" });
  });
  it("says so when there is no sign-in, and sends nothing", async () => {
    const seen: { url?: string } = {};
    await expect(callEngine("get", undefined, deps(json(200, {}), seen, null))).rejects.toMatchObject({ code: "not_signed_in" });
    expect(seen.url).toBeUndefined();
  });
  it("keeps the server's line for a refusal and gives a plain line for a dead network or a page that is not JSON", async () => {
    await expect(callEngine("set", "laya", deps(json(409, { ok: false, error: "laya_not_deployed", message: "Laya is not deployed yet." })))).rejects.toMatchObject({ message: "Laya is not deployed yet.", code: "laya_not_deployed" });
    await expect(callEngine("get", undefined, deps(async () => { throw new Error("down"); }))).rejects.toMatchObject({ code: "network" });
    await expect(callEngine("get", undefined, deps(json(502, "<html>")))).rejects.toBeInstanceOf(EngineError);
  });
  it("lists the three engines with Laya not deployed", () => {
    expect(ENGINES.map((e) => [e.key, e.ready])).toEqual([["rules", true], ["jev", true], ["laya", false]]);
  });
});
