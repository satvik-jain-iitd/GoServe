// Story #1067: the real library builds the request (RFC 8291 payload, RFC 8292 VAPID); our fetch sends it. No push service is reached: the fetch is the test's own.
import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { TTL_S, webSender } from "./webpush.ts";

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

Deno.test("a push carries VAPID, ttl 600, urgency high and an encrypted body, to the subscription's address", async () => {
  const phone = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const server = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const vapid = { subject: "mailto:ops@goserve.test", publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", server.publicKey))), privateKey: (await crypto.subtle.exportKey("jwk", server.privateKey)).d! };
  const seen: { url: string; init: RequestInit }[] = [];
  const fake = ((url: string, init: RequestInit) => { seen.push({ url, init }); return Promise.resolve(new Response(null, { status: 201 })); }) as unknown as typeof fetch;
  const sub = { endpoint: "https://push.example/send/abc", p256dh: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", phone.publicKey))), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) };
  const res = await webSender(vapid, fake)(sub, JSON.stringify({ title: "GoServe", body: "Your order is ready." }));
  assertEquals(res.status, 201);
  assertEquals(seen.length, 1);
  assertEquals(seen[0].url, sub.endpoint);
  const h = new Headers(seen[0].init.headers);
  assertMatch(h.get("authorization") ?? "", /^vapid t=.+, k=.+$/);
  assertEquals([h.get("ttl"), h.get("urgency"), h.get("content-encoding")], [String(TTL_S), "high", "aes128gcm"]);
  assertEquals(seen[0].init.method, "POST");
  assertEquals((seen[0].init.body as Uint8Array).length > 80, true);   // the text is inside, encrypted; it is not the plain JSON
  assertEquals(new TextDecoder().decode(seen[0].init.body as Uint8Array).includes("Your order is ready"), false);
});
