// The customer flow in one place: menu, cart, bill, placed (story #48). No router yet: four steps in state.
import { useEffect, useMemo, useRef, useState } from "react";
import { addDish, cartLines, cartTotal, changeQty, toOrderItems, type Cart } from "./lib/cart";
import { loadMenu, type Dish } from "./lib/menu";
import { placeOrder, PlaceError, type PlacedOrder } from "./lib/orders";
import { ensureSession, fetchMenuRows } from "./lib/supabase";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { BillScreen } from "./screens/BillScreen";
import { PlacedScreen } from "./screens/PlacedScreen";

type Step = "menu" | "cart" | "bill" | "placed";

export function App() {
  const [menu, setMenu] = useState<{ dishes: Dish[]; fromCache: boolean } | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("menu");
  const [cart, setCart] = useState<Cart>({});
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  // One key per cart: a retry of the same cart reuses it, so the server never makes two orders. A changed cart gets a new key.
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    loadMenu(fetchMenuRows, window.localStorage).then(setMenu, (e: Error) => setMenuError(e.message));
  }, []);

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
        { url: import.meta.env.VITE_ORDER_URL, token: import.meta.env.VITE_DEMO_TOKEN, fetchFn: fetch.bind(window) },
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
    </main>
  );
}
