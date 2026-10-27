// Story #356: one run_log row per call, and a request id on every answer. Wrap a handler with withRunLog and nothing else changes.
// The row holds the function, the status, the time and, for a failure, the error CODE and the request id. It never holds the request, the message
// or any answer text. A log that cannot be written is dropped silently: the answer comes first.
export type Row = { workflow: string; request_id: string; status: number; duration_ms: number; error: string | null };
export type Write = (row: Row) => Promise<unknown>;

const PLAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CODE = /^[a-z0-9_]{1,60}$/;

async function errorOf(res: Response): Promise<string | null> {
  if (res.status < 400) return null;
  try {
    const code = (await res.clone().json())?.error;
    if (typeof code === "string" && CODE.test(code)) return code;
  } catch { /* not JSON: fall through */ }
  return `http_${res.status}`;
}

export const withRunLog = (name: string, handler: (req: Request) => Promise<Response>, write: Write) => async (req: Request): Promise<Response> => {
  const sent = req.headers.get("x-request-id") ?? "";
  const id = PLAIN_ID.test(sent) ? sent : crypto.randomUUID();
  const started = performance.now();
  let res: Response;
  let error: string | null;
  try {
    res = await handler(req);
    error = await errorOf(res);
  } catch {
    res = new Response(JSON.stringify({ ok: false, error: "internal_error" }), { status: 500, headers: { "content-type": "application/json" } });
    error = "exception";
  }
  const out = new Response(res.body, res);
  out.headers.set("x-request-id", id);
  // Not awaited: the answer must not wait for the log. waitUntil keeps the write alive after the answer on the Edge runtime.
  const wrote = Promise.resolve().then(() => write({ workflow: `fn:${name}`, request_id: id, status: res.status, duration_ms: Math.round(performance.now() - started), error })).catch(() => {});
  (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(wrote);
  return out;
};

// The real writer: PostgREST with the service key (run_log is not public). session_id v2 keeps these rows apart from the demo sessions.
export const writeRunLog: Write = async (row) => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!key || !url) return;
  await fetch(`${url}/rest/v1/run_log`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ ...row, session_id: "v2" }) });
};
