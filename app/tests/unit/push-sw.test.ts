// Story #1067: the service worker shows the words that come inside the push (no round trip to the database), and still asks the database when a push has none (the empty pushes of MAIN 34).
import { describe, expect, it, vi } from "vitest";
import { pushWorkerSource } from "../../src/pwa-push";

function worker() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const shown: { title: string; opts: { body: string; tag: string } }[] = [];
  const fetched: string[] = [];
  const self = {
    addEventListener: (n: string, f: (e: unknown) => void) => { handlers[n] = f; },
    registration: { pushManager: { getSubscription: async () => ({ endpoint: "https://push.example/abc" }) }, showNotification: async (title: string, opts: { body: string; tag: string }) => { shown.push({ title, opts }); } },
  };
  const fetchFn = vi.fn(async (url: string) => {
    fetched.push(url);
    return { ok: true, json: async () => (url.endsWith("push_latest") ? { title: "GoServe", body: "From the database.", order_id: "dbo" } : null) };
  });
  new Function("self", "fetch", "clients", pushWorkerSource("https://x.supabase.co", "anon"))(self, fetchFn, { openWindow: async () => undefined });
  const push = async (data: unknown) => {
    const waits: Promise<unknown>[] = [];
    handlers.push({ data: data === undefined ? null : { json: () => data }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { push, shown, fetched };
}

describe("push event", () => {
  it("shows the title, the words and the order tag that came inside the push, and does not ask the database for them", async () => {
    const w = worker();
    await w.push({ title: "GoServe", body: "Your order is ready.", order_id: "o1", status: "ready" });
    expect(w.shown).toEqual([{ title: "GoServe", opts: expect.objectContaining({ body: "Your order is ready.", tag: "o1" }) }]);
    expect(w.fetched.filter((u) => u.endsWith("push_latest"))).toEqual([]);
  });
  it("a push with no words still asks the database, as before", async () => {
    const w = worker();
    await w.push(undefined);
    expect(w.fetched.some((u) => u.endsWith("push_latest"))).toBe(true);
    expect(w.shown[0].opts).toMatchObject({ body: "From the database.", tag: "dbo" });
  });
  it("words that cannot be read, or an empty body, fall back to asking the database; a notification is always shown", async () => {
    const w = worker();
    await w.push({ title: "GoServe", body: "" });
    expect(w.shown).toHaveLength(1);
    expect(w.fetched.some((u) => u.endsWith("push_latest"))).toBe(true);
  });
});
