// Web push (story A7). The customer allows notifications once; the phone subscribes with our public key and the subscription is saved in the database.
// The server sends a push with no text; the service worker (pwa-push.ts) asks the database what to say.
export type PushResult = "on" | "denied" | "unsupported" | "not_set_up" | "failed";

// The public key comes as url-safe base64 without padding.
export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const raw = atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function subscriptionPayload(sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }) {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) throw new Error("The subscription has no keys.");
  return { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth };
}

type Deps = {
  vapidKey: string;
  supported: () => boolean;
  permission: () => Promise<NotificationPermission | string>;
  subscribe: (key: Uint8Array) => Promise<{ toJSON: () => { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }>;
  save: (payload: { p_endpoint: string; p_p256dh: string; p_auth: string }) => Promise<string | null>;   // null on success
};

// Ask once, subscribe, save. Never throws: the caller shows a reminder either way.
export async function enablePush(d: Deps): Promise<PushResult> {
  if (!d.supported()) return "unsupported";
  if (!d.vapidKey) return "not_set_up";
  try {
    if ((await d.permission()) !== "granted") return "denied";
    const sub = await d.subscribe(urlBase64ToUint8Array(d.vapidKey));
    return (await d.save(subscriptionPayload(sub.toJSON()))) === null ? "on" : "failed";
  } catch {
    return "failed";
  }
}

// Story #613: a sign out and a sign in give the phone a new session id, but the subscription stays on the old one and no push is queued for the new session's orders.
// Call `resync` (save the subscription again, it moves to the current session) when the first session appears and whenever the session id changes. A sign out (no session) does nothing.
export function watchSession(subscribe: (cb: (id: string | null) => void) => () => void, resync: () => void): () => void {
  let last: string | null = null;
  return subscribe((id) => { if (id && id !== last) { last = id; resync(); } });
}
