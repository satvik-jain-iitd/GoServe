// Story (P0 from the first prod sitting, 29 Oct 2026): the app runs in a browser on another origin than the functions, so every function must answer the CORS
// preflight (OPTIONS) with 204 and put Access-Control-Allow-Origin on every answer for an allowed origin. Before this, OPTIONS got 405 and no ACAO header,
// the browser blocked the POST, and the app showed "Could not reach GoServe". The mocked Playwright specs could not see it.
// Run: deno test --allow-read api supabase/functions   (no network: a PUT to every handler is refused by the handler itself, before any database call)
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const NAMES = ["coupons", "health", "help", "me", "menu", "order-actions", "orders", "otp", "payments", "push", "quote", "serviceability", "staff"];
const ALLOWED = ["https://goserve-app.pages.dev", "https://goserve-app-dev.vercel.app", "http://localhost:5173"];
const req = (name: string, method: string, origin: string | null, path = "") =>
  new Request(`https://x.test/functions/v1/${name}${path}`, { method, headers: origin ? { origin, "access-control-request-method": "POST" } : {} });

for (const name of NAMES) {
  Deno.test(`${name}: OPTIONS from an allowed origin answers 204 with the allow headers`, async () => {
    const { handler } = await import(`./${name}/index.ts`);
    for (const origin of ALLOWED) {
      const res = await handler(req(name, "OPTIONS", origin));
      assertEquals(res.status, 204, `${name} ${origin}`);
      assertEquals(res.headers.get("access-control-allow-origin"), origin);
      assertEquals(res.headers.get("vary")?.includes("Origin"), true);
      const headers = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
      for (const h of ["authorization", "apikey", "content-type", "x-client-info"]) assertEquals(headers.includes(h), true, `${name} allows ${h}`);
      const methods = res.headers.get("access-control-allow-methods") ?? "";
      for (const m of ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]) assertEquals(methods.includes(m), true, `${name} allows ${m}`);
    }
  });

  Deno.test(`${name}: OPTIONS from another origin, or with none, gets no allow-origin`, async () => {
    const { handler } = await import(`./${name}/index.ts`);
    for (const origin of ["https://evil.example", null]) {
      const res = await handler(req(name, "OPTIONS", origin));
      assertEquals(res.headers.get("access-control-allow-origin"), null, `${name} ${origin}`);
    }
  });

  Deno.test(`${name}: a normal answer carries the allow-origin for an allowed origin and not for another`, async () => {
    const { handler } = await import(`./${name}/index.ts`);
    const ok = await handler(req(name, "PUT", ALLOWED[0], "/nope"));   // refused by the handler itself: 404 or 405, no database call
    assertNotEquals(ok.status, 204);
    assertEquals(ok.headers.get("access-control-allow-origin"), ALLOWED[0]);
    await ok.body?.cancel();
    const other = await handler(req(name, "PUT", "https://evil.example", "/nope"));
    assertEquals(other.headers.get("access-control-allow-origin"), null);
    await other.body?.cancel();
  });
}
