// The live list of this session's orders for the kitchen, the rider and the customer tracker (stories #49 and #50).
// While `active` is true it reads the list, listens for changes, and reads again once the subscription is confirmed.
import { useEffect, useState } from "react";
import { mergeOrder, type Order } from "./kitchen";
import { fetchOrders, watchOrders } from "./live";
import { currentSession, myKitchen, scopeFor } from "./session";
import { getClient } from "./supabase";

// `kitchenApp` is true only on /kitchen/: a staff user there reads the kitchen's orders (S-M5); everywhere else the session's.
export function useLiveOrders(active: boolean, kitchenApp = false) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How long a new order took to reach this screen: server time of the order to this device's clock, for orders that arrived live.
  // The two clocks can differ a little, so a negative result is shown as 0.
  const [lags, setLags] = useState<number[]>([]);

  useEffect(() => {
    if (!active) return;
    let stop = () => {};
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sessionId = await currentSession();
        const client = getClient();
        const scope = scopeFor(kitchenApp ? await myKitchen(client) : null, sessionId);
        const reload = async () => {
          const rows = await fetchOrders(client, scope);
          if (alive) setOrders((cur) => rows.reduce(mergeOrder, cur));
        };
        stop = watchOrders(client, scope, (o, event) => {
          if (!alive) return;
          if (event === "INSERT") setLags((cur) => [...cur, Math.max(0, Date.now() - Date.parse(o.created_at))]);
          setOrders((cur) => mergeOrder(cur, o));
        }, () => void reload().catch(() => {}), (id) => {
          if (!alive) return;
          setOrders((cur) => cur.filter((o) => o.id !== id));
          setLags([]);   // after a reset the old timings no longer describe this demo
        });
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
  }, [active, kitchenApp]);

  return { orders, loading, error, lags, setOrders, setError, setLags };
}
