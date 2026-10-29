// Story #337: the first Edge Function of backend v2. It says the server is up and nothing else (no project, key or database detail).
export function handler(req: Request): Response {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const body = req.method === "HEAD" ? null : JSON.stringify({ ok: true, service: "health", time: new Date().toISOString() });
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

if (import.meta.main) Deno.serve(handler);
