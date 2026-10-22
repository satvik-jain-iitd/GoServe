// After a refresh the customer app forgets its screen. The order list has the answer: the newest order that is not delivered yet.
import type { Order } from "./kitchen";

export const openOrderToResume = (orders: Order[]): Order | null =>
  orders.filter((o) => o.status !== "delivered").sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
