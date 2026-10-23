// After a refresh the customer app forgets its screen. The order list has the answer: the newest order that is still open (not delivered, not cancelled).
import type { Order } from "./kitchen";

export const openOrderToResume = (orders: Order[]): Order | null =>
  orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
