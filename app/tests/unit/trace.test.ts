// Story #484: the phone and the service worker leave lines in order_trace, so "what happened to order X" is read from logs, never guessed.
import { describe, expect, it, vi } from "vitest";
import { trace } from "../../src/lib/trace";
import { pushWorkerSource } from "../../src/pwa-push";

describe("trace (the app)", () => {
  it("calls trace_app with the order, event, result and text", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await trace({ rpc }, "o1", "delivered_answer", "yes", "after 2 min");
    expect(rpc).toHaveBeenCalledWith("trace_app", { p_order: "o1", p_event: "delivered_answer", p_result: "yes", p_text: "after 2 min" });
  });
  it("never throws and never waits for the network to matter: a failed call is swallowed", async () => {
    await expect(trace({ rpc: vi.fn().mockRejectedValue(new Error("offline")) }, null, "app_open")).resolves.toBeUndefined();
    await expect(trace({ rpc: vi.fn().mockResolvedValue({ error: { message: "boom" } }) }, null, "app_open")).resolves.toBeUndefined();
  });
  it("an event with no order sends null", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await trace({ rpc }, null, "app_open");
    expect(rpc.mock.calls[0][1]).toEqual({ p_order: null, p_event: "app_open", p_result: null, p_text: null });
  });
});

describe("service worker trace", () => {
  // Run the generated worker source with a fake self, a fake fetch and a fake registration.
  function boot(opts: { rpcOk?: boolean; showFails?: boolean } = {}) {
    const calls: { fn: string; body: Record<string, string> }[] = [];
    const listeners: Record<string, (e: unknown) => void> = {};
    const self = {
      addEventListener: (n: string, f: (e: unknown) => void) => (listeners[n] = f),
      registration: { pushManager: { getSubscription: async () => ({ endpoint: "https://web.push.apple.com/SECRET" }) }, showNotification: async () => { if (opts.showFails) throw new Error("denied"); } },
    };
    const fetch = async (url: string, init: { body: string }) => {
      calls.push({ fn: url.split("/rpc/")[1], body: JSON.parse(init.body) });
      return { ok: opts.rpcOk !== false, json: async () => ({ body: "Your order is ready." }) };
    };
    const clients = { openWindow: async () => undefined };
    new Function("self", "fetch", "clients", pushWorkerSource("https://x.supabase.co", "ANON"))(self, fetch, clients);
    const fire = async (name: string) => {
      let p: Promise<unknown> = Promise.resolve();
      listeners[name]({ waitUntil: (x: Promise<unknown>) => (p = x), notification: { close: () => undefined } });
      await p;
    };
    return { calls, fire };
  }
  const events = (calls: { fn: string; body: Record<string, string> }[]) => calls.filter((c) => c.fn === "trace_sw").map((c) => [c.body.p_event, c.body.p_result]);

  it("a push logs received, then shown", async () => {
    const w = boot();
    await w.fire("push");
    expect(events(w.calls)).toEqual([["push_received", "ok"], ["notification_shown", "ok"]]);
  });
  it("a notification that cannot be shown logs notification_failed with the reason", async () => {
    const w = boot({ showFails: true });
    await w.fire("push").catch(() => undefined);
    expect(events(w.calls).map((e) => e[0])).toEqual(["push_received", "notification_failed"]);
  });
  it("a tap logs notification_click", async () => {
    const w = boot();
    await w.fire("notificationclick");
    expect(events(w.calls)).toEqual([["notification_click", "ok"]]);
  });
  it("the log call carries the push address (the database turns it into the order) and uses only the public key", async () => {
    const w = boot();
    await w.fire("push");
    expect(w.calls.find((c) => c.fn === "trace_sw")!.body.p_endpoint).toBe("https://web.push.apple.com/SECRET");
    expect(pushWorkerSource("https://x.supabase.co", "ANON")).not.toMatch(/service_role/i);
  });
});
