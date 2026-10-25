// Story #263: the admin app picks the live decision engine (Rules, Jev or Laya) through n8n GS MAIN 32. The call carries the signed-in admin's own token;
// the database checks that the caller is an admin. No secret is built into the app.
import { getClient } from "./supabase";

export class EngineError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
export type EngineKey = "rules" | "jev" | "laya";
export const ENGINES: { key: EngineKey; label: string; hint: string; ready: boolean }[] = [
  { key: "rules", label: "Rules", hint: "Free rider with the fewest trips, then the shortest way. No outside call. Cost zero.", ready: true },
  { key: "jev", label: "Jev", hint: "Asks Jev for advice on each order. The rule still decides if Jev is slow or unsure.", ready: true },
  { key: "laya", label: "Laya", hint: "Not deployed yet", ready: false },
];
export type EngineAnswer = { ok: boolean; engine: EngineKey; version: number; by?: string; changed_at?: string };
export type EngineDeps = { url: string; getToken: () => Promise<string | null>; fetchFn: typeof fetch };
export const engineDeps = (): EngineDeps => ({
  url: import.meta.env.VITE_ENGINE_URL,
  fetchFn: fetch.bind(window),
  getToken: async () => (await getClient().auth.getSession()).data.session?.access_token ?? null,
});

export async function callEngine(action: "get" | "set", engine: EngineKey | undefined, deps: EngineDeps): Promise<EngineAnswer> {
  const token = await deps.getToken();
  if (!token) throw new EngineError("Please sign in again.", "not_signed_in");
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(action === "set" ? { action, engine } : { action }) });
  } catch {
    throw new EngineError("No network. Check your connection and try again.", "network");
  }
  let answer: (EngineAnswer & { error?: string; message?: string }) | null = null;
  try { answer = await res.json(); } catch { answer = null; }
  if (res.ok && answer && answer.ok) return answer;
  if (answer && answer.ok === false && typeof answer.message === "string") throw new EngineError(answer.message, answer.error ?? "unknown");
  throw new EngineError("Something went wrong. Please try again.", "unknown");
}
