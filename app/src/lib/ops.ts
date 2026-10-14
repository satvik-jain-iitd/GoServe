// The ops screen's logic (story #51): the suggestion line from one decision_log row, and plain-number metrics.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Decision = {
  rule_pick: string;
  chosen_pick: string;
  jev_status: string;
  jev: { pick: string; confidence: number; agrees: boolean; ms?: number } | null;
};
export type DecisionRow = { order_id: string | null; created_at: string; decision: Decision };
export type Rider = { id: string; free: boolean; distance_m: number; trips_done: number };

// Three demo riders (assumption A42): the free flag and the distance are the phone's word. The rule picks r2 (fewest trips).
export const DEMO_RIDERS: Rider[] = [
  { id: "r1", free: true, distance_m: 1800, trips_done: 3 },
  { id: "r2", free: true, distance_m: 900, trips_done: 1 },
  { id: "r3", free: false, distance_m: 400, trips_done: 0 },
];

export const riderLabel = (id: string) => (id === "none" ? "none" : id.toUpperCase());

const WHY: Record<string, string> = {
  jev_off: "it is off",
  jev_error: "it did not answer",
  jev_bad_reply: "its reply was not usable",
  cost_cap: "the call cost too much",
};

export function suggestionText(d: Decision): string {
  if (d.rule_pick === "none") return "No rider is free.";
  const rule = riderLabel(d.rule_pick);
  const j = d.jev;
  if (j && d.jev_status === "ok") {
    const ai = `AI suggests rider ${riderLabel(j.pick)} (${Math.round(j.confidence * 100)}%).`;
    return j.agrees ? `${ai} The rule agrees.` : `${ai} The rule picked ${rule}.`;
  }
  if (j && d.jev_status === "jev_low_confidence") return `AI suggests rider ${riderLabel(j.pick)} (${Math.round(j.confidence * 100)}%), too unsure to use. The rule picked ${rule}.`;
  return `AI gave no suggestion (${WHY[d.jev_status] ?? "no reason given"}). The rule picked ${rule}.`;
}

export const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

export async function fetchDecisions(client: SupabaseClient, sessionId: string): Promise<DecisionRow[]> {
  const { data, error } = await client.from("decision_log").select("order_id, created_at, decision").eq("session_id", sessionId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DecisionRow[];
}

// Runs today (a count) and how long the latest decision call took (its own query, so many other runs cannot push it out). Both read run_log rows of this session.
export async function fetchRunStats(client: SupabaseClient, sessionId: string): Promise<{ runsToday: number; lastDecideMs: number | null }> {
  const [runs, last] = await Promise.all([
    client.from("run_log").select("id", { count: "exact", head: true }).eq("session_id", sessionId).gte("created_at", startOfToday()),
    client.from("run_log").select("duration_ms").eq("session_id", sessionId).like("workflow", "%: decide").order("created_at", { ascending: false }).limit(1),
  ]);
  if (runs.error) throw runs.error;
  if (last.error) throw last.error;
  return { runsToday: runs.count ?? 0, lastDecideMs: last.data?.length ? Number(last.data[0].duration_ms) : null };
}
