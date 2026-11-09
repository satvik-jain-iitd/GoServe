// Story #1067: one web push to one subscription (RFC 8030 push, RFC 8291 encrypted payload, RFC 8292 VAPID). The library builds the request; this file does the fetch,
// so a test can hand in its own fetch and never reach a push service. Urgency high (the alert is for now), TTL 600 s (an alert older than ten minutes is not worth showing).
import type { Vapid } from "./vapid.ts";

export type WebSub = { endpoint: string; p256dh: string; auth: string };
export type WebSend = (sub: WebSub, payload: string) => Promise<{ status: number }>;
export const TTL_S = 600;

export const webSender = (vapid: Vapid, fetchFn: typeof fetch = fetch): WebSend => async (sub, payload) => {
  const { default: webpush } = await import("npm:web-push@3.6.7");   // loaded when a push is sent, so the handler tests never need it
  const d = await webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload,
    { vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: TTL_S, urgency: "high" });
  const res = await fetchFn(d.endpoint, { method: d.method, headers: d.headers, body: d.body });
  await res.body?.cancel();
  return { status: res.status };
};
