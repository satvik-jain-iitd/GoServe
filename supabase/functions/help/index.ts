// Story #355: GET /help. The topics with their questions and answers, from the faq table. The database orders them and leaves out what is switched off.
import { withRunLog, writeRunLog } from "../_shared/runlog.ts";

export type Topic = { topic: string; items: { question: string; answer: string }[] };
export type Deps = { topics: () => Promise<Topic[]> };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const makeHandler = (deps: Deps) => async (req: Request): Promise<Response> => {
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } });
  try {
    return json(200, { ok: true, topics: await deps.topics() });
  } catch {
    return json(502, { ok: false, error: "help_unavailable" });   // no detail: a database message must never reach an app
  }
};

const live: Deps = {
  topics: async () => {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")!}/rest/v1/rpc/help_v2`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}" });
    if (!res.ok) throw new Error("rpc failed");
    return (await res.json()).topics;
  },
};
export const handler = withRunLog("help", makeHandler(live), writeRunLog);   // story #356: one run_log row per call

if (import.meta.main) Deno.serve(handler);
