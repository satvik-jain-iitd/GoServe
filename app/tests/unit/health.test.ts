// Story #54: the health page's checks. Each check answers OK or FAIL with a time and a plain note.
import { describe, expect, it } from "vitest";
import { checkOrderApi, checkSupabase } from "../../src/lib/health";

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
const deps = (res: () => Promise<Response>) => ({ url: "https://n8n.test/webhook/gs-order", token: "t", fetchFn: (async () => res()) as typeof fetch });
const jevOk = { ok: true, jev: { ok: true, status: "ok", ms: 310 } };

describe("checkSupabase", () => {
  const sb = (res: () => Promise<Response>) => checkSupabase((async () => res()) as typeof fetch, "https://x.supabase.co", "anon");
  it("S1 is OK when the menu answers", async () => {
    const c = await sb(json(200, [{ id: "d1" }]));
    expect([c.name, c.ok]).toEqual(["Supabase", true]);
    expect(c.ms).toBeGreaterThanOrEqual(0);
  });
  it("S1 is FAIL with a note when the database errors or cannot be reached", async () => {
    expect(await sb(json(500, {}))).toMatchObject({ ok: false, note: "Unexpected answer (500)." });
    expect(await sb(async () => { throw new Error("x"); })).toMatchObject({ ok: false, ms: null, note: "No answer." });
  });
  it("asks for one menu row with the anon key", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    await checkSupabase((async (u: string, i: RequestInit) => { seen.url = u; seen.init = i; return new Response("[]", { status: 200 }); }) as typeof fetch, "https://x.supabase.co", "anon");
    expect(seen.url).toBe("https://x.supabase.co/rest/v1/menu_items?select=id&limit=1");
    expect((seen.init?.headers as Record<string, string>).apikey).toBe("anon");
  });
});

describe("checkOrderApi", () => {
  it("S1 n8n and Jev are both OK when the health call answers with a Jev time", async () => {
    const [n8n, jev] = await checkOrderApi(deps(json(200, jevOk)));
    expect([n8n.name, n8n.ok, jev.name, jev.ok, jev.ms]).toEqual(["n8n", true, "Jev", true, 310]);
    expect(n8n.ms).toBeGreaterThanOrEqual(0);
  });
  it("S1 posts the health action with the demo token", async () => {
    const seen: { init?: RequestInit } = {};
    await checkOrderApi({ url: "u", token: "tok", fetchFn: (async (_u: string, i: RequestInit) => { seen.init = i; return new Response(JSON.stringify(jevOk), { status: 200 }); }) as typeof fetch });
    expect(JSON.parse(seen.init?.body as string)).toEqual({ action: "health" });
    expect((seen.init?.headers as Record<string, string>)["x-gs-token"]).toBe("tok");
  });
  it("S1 n8n is OK and Jev is FAIL with the reason when Jev did not answer", async () => {
    const [n8n, jev] = await checkOrderApi(deps(json(200, { ok: true, jev: { ok: false, status: "jev_error", ms: 3000 } })));
    expect([n8n.ok, jev.ok, jev.note]).toEqual([true, false, "Jev did not answer."]);
    const [, off] = await checkOrderApi(deps(json(200, { ok: true, jev: { ok: false, status: "jev_off", ms: null } })));
    expect(off.note).toBe("Jev is switched off.");
  });
  it("S1 n8n FAIL says why, and Jev is not checked", async () => {
    const why = async (res: () => Promise<Response>) => (await checkOrderApi(deps(res))).map((c) => [c.ok, c.note]);
    expect(await why(json(401, { ok: false, error: "unauthorized" }))).toEqual([[false, "The demo token is wrong."], [false, "Not checked: n8n failed."]]);
    expect(await why(json(503, { ok: false, error: "kill_switch" }))).toEqual([[false, "The kill switch is on."], [false, "Not checked: n8n failed."]]);
    expect(await why(json(404, {}))).toEqual([[false, "The workflow is not active."], [false, "Not checked: n8n failed."]]);
    expect(await why(async () => { throw new Error("x"); })).toEqual([[false, "No answer."], [false, "Not checked: n8n failed."]]);
    expect(await why(json(200, { ok: true }))).toEqual([[false, "Unexpected answer (200)."], [false, "Not checked: n8n failed."]]);
  });
});
