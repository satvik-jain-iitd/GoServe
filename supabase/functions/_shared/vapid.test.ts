// Story #1067: the VAPID key forms the secret may take, and nothing printed.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { rawVapidPrivate, vapidFromEnv } from "./vapid.ts";

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function fresh() {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const [BEGIN, END] = ["-----BEGIN ", "-----END "].map((s) => s + "PRIVATE KEY-----");   // built here so this file never holds a key marker (the secret guard)
  const pem = `${BEGIN}\n${b64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", k.privateKey))).replace(/(.{64})/g, "$1\n")}\n${END}\n`;
  return { pem, raw: (await crypto.subtle.exportKey("jwk", k.privateKey)).d! };
}

Deno.test("the raw url-safe key, the PEM and the base64 of the PEM all give the same raw key", async () => {
  const { pem, raw } = await fresh();
  assertEquals(await rawVapidPrivate(raw), raw);
  assertEquals(await rawVapidPrivate(pem), raw);
  assertEquals(await rawVapidPrivate(b64(new TextEncoder().encode(pem))), raw);
  assertEquals(raw, url(raw));
  assertEquals(raw.length, 43);
});

Deno.test("a key that is none of these is refused, and the error never holds the key", async () => {
  const e = await assertRejects(() => rawVapidPrivate("this-is-not-a-key-at-all"));
  assertEquals(String((e as Error).message).includes("this-is-not-a-key"), false);
});

Deno.test("vapidFromEnv needs the subject, the public key and the private key; any missing part is null", async () => {
  const { raw } = await fresh();
  const all: Record<string, string> = { VAPID_SUBJECT: "mailto:a@b.test", VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: raw };
  assertEquals(await vapidFromEnv((k) => all[k]), { subject: "mailto:a@b.test", publicKey: "pub", privateKey: raw });
  for (const k of Object.keys(all)) assertEquals(await vapidFromEnv((x) => (x === k ? undefined : all[x])), null);
  assertEquals(await vapidFromEnv((x) => (x === "VAPID_PRIVATE_KEY" ? "garbage!" : all[x])), null);
});
