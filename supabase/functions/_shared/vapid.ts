// Story #1067: the VAPID private key as web-push wants it, the raw 32 bytes in URL-safe base64. The secret may be that raw form, or the PEM (PKCS8) of the key,
// plain or base64 of the PEM (how the vault keeps it: GOSERVE_VAPID_PRIVATE_KEY_PEM_B64). Nothing here ever prints the key.
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const RAW = /^[A-Za-z0-9_-]{43}$/;

export async function rawVapidPrivate(secret: string): Promise<string> {
  const s = secret.trim();
  if (RAW.test(s)) return s;
  const pem = s.includes("BEGIN") ? s : new TextDecoder().decode(b64(s));
  const body = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", b64(body), { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  if (!jwk.d) throw new Error("not a private key");
  return url(jwk.d);
}

export type Vapid = { subject: string; publicKey: string; privateKey: string };
// null when any part is missing: the function then says web push is not configured, and no row is claimed.
export async function vapidFromEnv(get: (k: string) => string | undefined = (k) => Deno.env.get(k)): Promise<Vapid | null> {
  const [subject, publicKey, secret] = [get("VAPID_SUBJECT"), get("VAPID_PUBLIC_KEY"), get("VAPID_PRIVATE_KEY")];
  if (!subject || !publicKey || !secret) return null;
  try { return { subject, publicKey, privateKey: await rawVapidPrivate(secret) }; } catch { return null; }
}
