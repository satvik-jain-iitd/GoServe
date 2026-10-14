// The customer flow in one place: menu, cart, bill, placed (story #48). No router yet: four steps in state.
import { useEffect, useMemo, useRef, useState } from "react";
import { addDish, cartLines, cartTotal, changeQty, toOrderItems, type Cart } from "./lib/cart";
import { kitchenOrders, mergeOrder, type Order } from "./lib/kitchen";
import { fetchOrders, watchOrders } from "./lib/live";
import { loadMenu, type Dish } from "./lib/menu";
import { changeStatus, placeOrder, PlaceError, type OrderDeps, type PlacedOrder } from "./lib/orders";
import { ensureSession, fetchMenuRows, getClient } from "./lib/supabase";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { BillScreen } from "./screens/BillScreen";
import { PlacedScreen } from "./screens/PlacedScreen";
import { KitchenScreen } from "./screens/KitchenScreen";

type Step = "menu" | "cart" | "bill" | "placed";
type Role = "customer" | "kitchen";

const api = (): OrderDeps => ({ url: import.meta.env.VITE_ORDER_URL, token: import.meta.env.VITE_DEMO_TOKEN, fetchFn: fetch.bind(window) });

export function App() {
  const [menu, setMenu] = useState<{ dishes: Dish[]; fromCache: boolean } | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("menu");
  const [cart, setCart] = useState<Cart>({});
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [role, setRole] = useState<Role>("customer");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [kitchenError, setKitchenError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  // One key per cart: a retry of the same cart reuses it, so the server never makes two orders. A changed cart gets a new key.
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    loadMenu(fetchMenuRows, window.localStorage).then(setMenu, (e: Error) => setMenuError(e.message));
  }, []);

  // The kitchen listens while its tab is open. One browser is one session, so the kitchen sees the orders this browser placed (ADR-010).
  useEffect(() => {
    if (role !== "kitchen") return;
    let stop = () => {};
    let alive = true;
    setOrdersLoading(true);
    setKitchenError(null);
    (async () => {
      try {
        const sessionId = await ensureSession();
        sessionRef.current = sessionId;
        const client = getClient();
        const reload = async () => { const rows = await fetchOrders(client); if (alive) setOrders((cur) => rows.reduce(mergeOrder, cur)); };
        stop = watchOrders(client, sessionId, (o) => alive && setOrders((cur) => mergeOrder(cur, o)), () => void reload().catch(() => {}));
        await reload();
      } catch {
        if (alive) setKitchenError("Could not load orders. Check your connection and try again.");
      } finally {
        if (alive) setOrdersLoading(false);
      }
    })();
    return () => { alive = false; stop(); };
  }, [role]);

  async function tap(order: Order, to: string) {
    setBusyId(order.id);
    setKitchenError(null);
    try {
      const { order: saved } = await changeStatus({ sessionId: order.session_id, orderId: order.id, to, actor: "kitchen" }, api());
      // The server's own updated_at decides which copy is newer, not this phone's clock.
      setOrders((cur) => mergeOrder(cur, { ...order, status: saved.status, updated_at: saved.updated_at ?? order.updated_at }));
    } catch (e) {
      setKitchenError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const lines = useMemo(() => cartLines(cart, menu?.dishes ?? []), [cart, menu]);
  const total = cartTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  async function place() {
    setSending(true);
    setError(null);
    try {
      const items = toOrderItems(cart);
      const fingerprint = JSON.stringify([items, address.trim()]);
      if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: crypto.randomUUID() };
      const sessionId = await ensureSession();
      const { order } = await placeOrder(
        { sessionId, key: keyRef.current.key, items, address: address.trim() },
        api(),
      );
      setPlaced(order);
      setStep("placed");
      setCart({});
      keyRef.current = null;
    } catch (e) {
      setError(e instanceof PlaceError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="shell">
      <h1>GoServe</h1>
      <nav className="roles" aria-label="Screen">
        {(["customer", "kitchen"] as const).map((r) => (
          <button key={r} type="button" className={role === r ? "btn" : "btn ghost"} aria-pressed={role === r} onClick={() => setRole(r)}>
            {r === "customer" ? "Customer" : "Kitchen"}
          </button>
        ))}
      </nav>
      {role === "kitchen" && (
        <KitchenScreen orders={kitchenOrders(orders)} loading={ordersLoading} error={kitchenError} busyId={busyId} onStep={tap} />
      )}
      {role === "customer" && (
        <>
        {menuError && <p role="alert" className="error">{menuError}</p>}
        {!menu && !menuError && <p>Loading the menu…</p>}
        {menu && step === "menu" && (
          <MenuScreen dishes={menu.dishes} fromCache={menu.fromCache} cartCount={count}
            onAdd={(id) => setCart((c) => addDish(c, id))} onOpenCart={() => setStep("cart")} />
        )}
        {menu && step === "cart" && (
          <CartScreen lines={lines} address={address} onAddress={setAddress} onChange={(id, d) => setCart((c) => changeQty(c, id, d))}
            onBack={() => setStep("menu")} onReview={() => { setError(null); setStep("bill"); }} />
        )}
        {menu && step === "bill" && (
          <BillScreen lines={lines} total={total} address={address.trim()} sending={sending} error={error}
            onBack={() => setStep("cart")} onPlace={place} />
        )}
        {step === "placed" && placed && <PlacedScreen order={placed} onAgain={() => { setPlaced(null); setStep("menu"); }} />}
        </>
      )}
    </main>
  );
}
