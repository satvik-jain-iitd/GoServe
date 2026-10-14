// What the kitchen sees: the orders of this session, newest first, and the one button each order can have (story #49).
// The rider's steps (out for delivery, delivered) belong to story #50, so after Ready the kitchen has no button.
export type OrderLine = { menu_item_id: string; name: string; qty: number; price_paise: number };
export type Order = {
  id: string; session_id: string; status: string; address: string; items: OrderLine[]; total_paise: number; created_at: string; updated_at: string;
};

export const shortId = (id: string): string => id.slice(0, 8);   // the order number the customer and the kitchen both say

const STEPS: Record<string, { to: string; label: string }> = {
  placed: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start" },
  preparing: { to: "ready", label: "Ready" },
};
export const nextStep = (status: string) => STEPS[status] ?? null;

const LABELS: Record<string, string> = { placed: "New", accepted: "Accepted", preparing: "Cooking", ready: "Ready" };
export const statusLabel = (status: string): string => LABELS[status] ?? status;

const WITH_RIDER = ["out_for_delivery", "delivered"];
export const kitchenOrders = (orders: Order[]): Order[] => orders.filter((o) => !WITH_RIDER.includes(o.status));

// A live event and the answer to a tap can arrive in either order: the copy with the later updated_at wins.
export const mergeOrder = (orders: Order[], incoming: Order): Order[] => {
  const old = orders.find((o) => o.id === incoming.id);
  if (old && old.updated_at > incoming.updated_at) return orders;
  return [...orders.filter((o) => o.id !== incoming.id), incoming].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};
