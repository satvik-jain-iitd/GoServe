// The health page's checks (story #54). Each one answers OK or FAIL with a time and a plain note. Nothing is written.
import type { OrderDeps } from "./orders";

export type Check = { name: "Supabase" | "n8n" | "Jev"; ok: boolean; ms: number | null; note: string };
const WAIT_MS = 5000;

const NOTES: Record<string, string> = {
  jev_off: "Jev is switched off.",
  jev_error: "Jev did not answer.",
  jev_bad_reply: "Jev's reply was not usable.",
};

// Supabase: read one menu row with the anon key, the same read the customer screen does.
export async function checkSupabase(fetchFn: typeof fetch, url: string, anonKey: string): Promise<Check> {
  const t0 = performance.now();
  try {
    const res = await fetchFn(`${url}/rest/v1/menu_items?select=id&limit=1`, { headers: { apikey: anonKey }, signal: AbortSignal.timeout(WAIT_MS) });
    const ms = Math.round(performance.now() - t0);
    return res.ok ? { name: "Supabase", ok: true, ms, note: "" } : { name: "Supabase", ok: false, ms, note: `Unexpected answer (${res.status}).` };
  } catch {
    return { name: "Supabase", ok: false, ms: null, note: "No answer." };
  }
}

// n8n and Jev: one call to the order webhook, action "health". n8n answering means the workflow is on, the token is right and the kill switch is off.
export async function checkOrderApi(deps: OrderDeps): Promise<[Check, Check]> {
  const skipped: Check = { name: "Jev", ok: false, ms: null, note: "Not checked: n8n failed." };
  const t0 = performance.now();
  const failN8n = (note: string, ms: number | null): [Check, Check] => [{ name: "n8n", ok: false, ms, note }, skipped];
  let res: Response;
  try {
    res = await deps.fetchFn(deps.url, { method: "POST", headers: { "content-type": "application/json", "x-gs-token": deps.token }, body: JSON.stringify({ action: "health" }), signal: AbortSignal.timeout(WAIT_MS) });
  } catch {
    return failN8n("No answer.", null);
  }
  const ms = Math.round(performance.now() - t0);
  if (res.status === 401) return failN8n("The demo token is wrong.", ms);
  if (res.status === 503) return failN8n("The kill switch is on.", ms);
  if (res.status === 404) return failN8n("The workflow is not active.", ms);
  let body: { ok?: boolean; jev?: { ok: boolean; status: string; ms: number | null } } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || !body?.ok || !body.jev) return failN8n(`Unexpected answer (${res.status}).`, ms);
  const j = body.jev;
  return [{ name: "n8n", ok: true, ms, note: "" }, { name: "Jev", ok: j.ok, ms: j.ms, note: j.ok ? "" : NOTES[j.status] ?? "Jev failed." }];
}
