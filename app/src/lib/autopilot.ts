// Autopilot (story #53): the order story plays one step at a time, so the founder can show it alone or in airplane mode.
import type { Decision, DecisionRow } from "./ops";
import type { Order } from "./kitchen";

export const AUTOPILOT_MS = Number(import.meta.env.VITE_AUTOPILOT_MS) || 2000;

export type AutoAction =
  | { kind: "status"; to: string; actor: "kitchen" | "rider" }
  | { kind: "event"; event: "order.arriving"; actor: "rider" };

// The kitchen takes the order to ready, then the rider picks up, arrives (once) and delivers.
const KITCHEN: Record<string, string> = { placed: "accepted", accepted: "preparing", preparing: "ready" };
export function nextAutoAction(status: string, arrived: boolean): AutoAction | null {
  if (KITCHEN[status]) return { kind: "status", to: KITCHEN[status], actor: "kitchen" };
  if (status === "ready") return { kind: "status", to: "out_for_delivery", actor: "rider" };
  if (status === "out_for_delivery") return arrived ? { kind: "status", to: "delivered", actor: "rider" } : { kind: "event", event: "order.arriving", actor: "rider" };
  return null;
}

// Local data for airplane mode. Nothing here comes from the server.
export const DEMO_ORDER_ID = "d3d0d3d0-0000-4000-8000-000000000001";
export function demoOrder(now = Date.now()): Order {
  const items = [
    { menu_item_id: "demo-1", name: "Butter Chicken", qty: 1, price_paise: 32000 },
    { menu_item_id: "demo-2", name: "Samosa (2 pieces)", qty: 2, price_paise: 6050 },
  ];
  const at = new Date(now).toISOString();
  return { id: DEMO_ORDER_ID, session_id: "demo", status: "placed", address: "Flat 4, Green Park, Delhi", items, total_paise: items.reduce((n, l) => n + l.qty * l.price_paise, 0), created_at: at, updated_at: at };
}
export const DEMO_DECISION: Decision = { rule_pick: "r2", chosen_pick: "r2", jev_status: "ok", jev: { pick: "r2", confidence: 0.81, agrees: true } };
export const demoDecisions = (): DecisionRow[] => [{ order_id: DEMO_ORDER_ID, created_at: new Date().toISOString(), decision: DEMO_DECISION }];
