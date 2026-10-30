// The app runs in a browser on another origin than the functions, so every function answers the CORS preflight (OPTIONS) with 204 and puts the allow headers on
// every answer for an origin on the list. An origin that is not on the list gets no allow-origin, so the browser blocks it. Server-to-server callers (pg_net, the
// payment webhook) send no Origin and are not affected. Wrap the outermost handler: `withCors(withRunLog(...))`, so a preflight writes no run_log row.
export const ALLOWED_ORIGINS = ["https://goserve-app.pages.dev", "https://goserve-app-dev.vercel.app", "http://localhost:5173"];
const HEADERS = "authorization, apikey, content-type, x-client-info, x-request-id";
const METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";

const allowOrigin = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? { "access-control-allow-origin": origin, "access-control-allow-headers": HEADERS, "access-control-allow-methods": METHODS, "access-control-max-age": "86400" } : {};
};

export const withCors = (handler: (req: Request) => Response | Promise<Response>) => async (req: Request): Promise<Response> => {
  const cors = allowOrigin(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, vary: "Origin" } });
  const res = await handler(req);
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  if (cors["access-control-allow-origin"]) { out.headers.append("vary", "Origin"); out.headers.set("access-control-expose-headers", "x-request-id"); }
  return out;
};
