// What the ops screen reads (story #51): this session's decisions and run numbers. A ready order with no decision yet is asked once.
import { useEffect, useRef, useState } from "react";
import type { Order } from "./kitchen";
import { askDecision, type OrderDeps } from "./orders";
import { DEMO_RIDERS, fetchDecisions, fetchRunStats, type DecisionRow } from "./ops";
import { currentSession } from "./session";
import { getClient } from "./supabase";

export function useOps(active: boolean, orders: Order[], deps: () => OrderDeps) {
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [stats, setStats] = useState({ runsToday: 0, lastDecideMs: null as number | null });
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});   // why an order got no decision, for its slip
  const asked = useRef(new Set<string>());   // one decision call per order, even if it fails: the screen shows why and does not loop
  const key = orders.map((o) => o.id + o.status).join();

  useEffect(() => {
    if (!active) return;
    let alive = true;
    (async () => {
      try {
        const sessionId = await currentSession();
        const client = getClient();
        let rows = await fetchDecisions(client, sessionId);
        const have = new Set(rows.map((r) => r.order_id));
        for (const o of orders.filter((x) => x.status === "ready" && !have.has(x.id) && !asked.current.has(x.id))) {
          asked.current.add(o.id);
          try {
            await askDecision({ sessionId, orderId: o.id, riders: DEMO_RIDERS }, deps());
            rows = await fetchDecisions(client, sessionId);
          } catch (e) {
            const why = e instanceof Error ? e.message : "Something went wrong. Please try again.";
            if (alive) {
              setError(why);
              setFailed((cur) => ({ ...cur, [o.id]: why }));
            }
          }
        }
        if (!alive) return;
        setDecisions(rows);
        setStats(await fetchRunStats(client, sessionId));
      } catch {
        if (alive) setError("Could not load the ops numbers. Check your connection and try again.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, key]);

  return { decisions, stats, error, failed };
}
