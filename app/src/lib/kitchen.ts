// What the kitchen sees: the orders of this session, newest first, and the one button each order can have (story #49).
// The rider's steps (out for delivery, delivered) belong to story #50, so after Ready the kitchen has no button.
export type OrderLine = { menu_item_id: string; name: string; qty: number; price_paise: number };
export type Order = {
  id: string; session_id: string; status: string; address: string; items: OrderLine[]; total_paise: number; created_at: string; updated_at: string; paid_by?: string | null;
  customer_name?: string | null; customer_phone?: string | null;
  kitchen_id?: string; rider_id?: string | null;
};

export const shortId = (id: string): string => id.slice(0, 8);   // the order number the customer and the kitchen both say

const STEPS: Record<string, { to: string; label: string }> = {
  placed: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start" },
  preparing: { to: "ready", label: "Ready" },
};
export const nextStep = (status: string) => STEPS[status] ?? null;

// One label map for the kitchen, the rider and the customer tracker.
const LABELS: Record<string, string> = { placed: "Placed", accepted: "Accepted", preparing: "Cooking", ready: "Ready", out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled" };
export const statusLabel = (status: string): string => LABELS[status] ?? status;

const WITH_RIDER = ["out_for_delivery", "delivered", "cancelled"];   // not the kitchen's any more
export const kitchenOrders = (orders: Order[]): Order[] => orders.filter((o) => !WITH_RIDER.includes(o.status));

// A live event and the answer to a tap can arrive in either order: the copy with the later updated_at wins.
// Moments are compared, not text: the same instant can be written with Z or +00:00.
export const mergeOrder = (orders: Order[], incoming: Order): Order[] => {
  const old = orders.find((o) => o.id === incoming.id);
  if (old && Date.parse(old.updated_at) > Date.parse(incoming.updated_at)) return orders;
  return [...orders.filter((o) => o.id !== incoming.id), incoming].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};

// ---- Story #50: the rider's buttons and the customer's progress list ----
export type RiderAction = { kind: "status"; to: string; label: string } | { kind: "event"; event: "order.arriving"; label: string } | { kind: "refused"; label: string };
export const riderActions = (status: string): RiderAction[] => {
  if (status === "ready") return [{ kind: "status", to: "out_for_delivery", label: "Pick up" }];
  if (status === "out_for_delivery") return [{ kind: "event", event: "order.arriving", label: "Arriving" }, { kind: "status", to: "delivered", label: "Delivered" }, { kind: "refused", label: "Not delivered" }];
  return [];
};
export const riderOrders = (orders: Order[]): Order[] => orders.filter((o) => o.status === "ready" || o.status === "out_for_delivery");

const FLOW = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];
export const trackerSteps = (status: string): { status: string; label: string; state: "done" | "current" | "todo" }[] => {
  const at = FLOW.indexOf(status);
  return FLOW.map((s, i) => ({ status: s, label: statusLabel(s), state: at < 0 || i > at ? "todo" : i === at ? "current" : "done" }));
};
