// Story A7 (#154): web push. The phone subscribes once; the service worker asks the database what to say; the server only sends a "tickle" with no text.
import { describe, expect, it, vi } from "vitest";
import { enablePush, subscriptionPayload, urlBase64ToUint8Array } from "../../src/lib/push";
import { pushWorkerSource } from "../../src/pwa-push";

describe("urlBase64ToUint8Array", () => {
  it("turns a url-safe base64 key into bytes", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);   // - and _ are + and /, and the padding may be left out
  });
});

describe("subscriptionPayload", () => {
  it("is the endpoint and the two keys, as the database function wants them", () => {
    expect(subscriptionPayload({ endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" } })).toEqual({ p_endpoint: "https://push.example/abc", p_p256dh: "P", p_auth: "A" });
  });
  it("refuses a subscription with no keys", () => {
    expect(() => subscriptionPayload({ endpoint: "https://x", keys: {} })).toThrow();
  });
});

describe("enablePush", () => {
  const sub = { toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" } }) };
  const deps = (over: object = {}) => ({
    vapidKey: "AQID", supported: () => true, permission: vi.fn().mockResolvedValue("granted"),
    subscribe: vi.fn().mockResolvedValue(sub), save: vi.fn().mockResolvedValue(null), ...over,
  });
  it("asks permission, subscribes with the public key and saves the subscription", async () => {
    const d = deps();
    expect(await enablePush(d)).toBe("on");
    expect(Array.from(d.subscribe.mock.calls[0][0] as Uint8Array)).toEqual([1, 2, 3]);
    expect(d.save).toHaveBeenCalledWith({ p_endpoint: "https://push.example/abc", p_p256dh: "P", p_auth: "A" });
  });
  it("says denied and saves nothing when the person says no", async () => {
    const d = deps({ permission: vi.fn().mockResolvedValue("denied") });
    expect(await enablePush(d)).toBe("denied");
    expect(d.save).not.toHaveBeenCalled();
  });
  it("says unsupported where the browser has no push, and not_set_up without a key", async () => {
    expect(await enablePush(deps({ supported: () => false }))).toBe("unsupported");
    expect(await enablePush(deps({ vapidKey: "" }))).toBe("not_set_up");
  });
  it("says failed, not on, when the save fails", async () => {
    expect(await enablePush(deps({ save: vi.fn().mockResolvedValue("boom") }))).toBe("failed");
  });
});

describe("the push service worker", () => {
  const run = (fetchAnswer: unknown) => {
    const listeners: Record<string, (e: unknown) => void> = {};
    const shown: { title: string; options: { body: string } }[] = [];
    const self = { addEventListener: (n: string, f: (e: unknown) => void) => { listeners[n] = f; },
      registration: { pushManager: { getSubscription: async () => ({ endpoint: "https://push.example/abc" }) }, showNotification: async (title: string, options: { body: string }) => { shown.push({ title, options }); } } };
    const opened: string[] = [];
    const fetchMock = vi.fn(async () => { if (fetchAnswer instanceof Error) throw fetchAnswer; return { ok: true, json: async () => fetchAnswer }; });
    new Function("self", "fetch", "clients", pushWorkerSource("https://db.test", "anon-key"))(self, fetchMock, { openWindow: (u: string) => opened.push(u) });
    const wait: Promise<unknown>[] = [];
    listeners.push({ waitUntil: (p: Promise<unknown>) => wait.push(p) });
    return { shown, fetchMock, opened, listeners, done: () => Promise.all(wait) };
  };
  it("asks the database for the latest order of this subscription and shows what it says", async () => {
    const w = run({ title: "GoServe", body: "Your order is ready." });
    await w.done();
    expect(w.shown).toEqual([{ title: "GoServe", options: expect.objectContaining({ body: "Your order is ready." }) }]);
    const [url, init] = (w.fetchMock.mock.calls as unknown as [string, { body: string; headers: Record<string, string> }][]).find((c) => c[0].endsWith("/push_latest"))!;
    expect(url).toBe("https://db.test/rest/v1/rpc/push_latest");
    expect(JSON.parse(init.body)).toEqual({ p_endpoint: "https://push.example/abc" });
    expect(init.headers.apikey).toBe("anon-key");
  });
  it("still shows a notification when the database cannot be reached (a push must always show one)", async () => {
    const w = run(new Error("offline"));
    await w.done();
    expect(w.shown[0].options.body).toBe("Your order has an update.");
  });
  it("opens the customer app when the notification is tapped", async () => {
    const w = run({ title: "GoServe", body: "x" });
    const tap = { notification: { close: vi.fn() }, waitUntil: (p: unknown) => p };
    w.listeners.notificationclick(tap);
    expect(tap.notification.close).toHaveBeenCalled();
    expect(w.opened).toEqual(["/customer/"]);
  });
});
