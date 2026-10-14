// The live list of this session's orders for the kitchen, the rider and the customer tracker (stories #49 and #50).
// While `active` is true it reads the list, listens for changes, and reads again once the subscription is confirmed.
import { useEffect, useState } from "react";
import { mergeOrder, type Order } from "./kitchen";
import { fetchOrders, watchOrders } from "./live";
import { ensureSession, getClient } from "./supabase";

export function useLiveOrders(active: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let stop = () => {};
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sessionId = await ensureSession();
        const client = getClient();
        const reload = async () => {
          const rows = await fetchOrders(client);
          if (alive) setOrders((cur) => rows.reduce(mergeOrder, cur));
        };
        stop = watchOrders(client, sessionId, (o) => alive && setOrders((cur) => mergeOrder(cur, o)), () => void reload().catch(() => {}));
        await reload();
      } catch {
        if (alive) setError("Could not load orders. Check your connection and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [active]);

  return { orders, loading, error, setOrders, setError };
}
