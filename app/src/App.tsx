// The customer flow in one place: menu, cart, bill, placed (story #48). No router yet: four steps in state.
import { useEffect, useMemo, useRef, useState } from "react";
import { addDish, cartLines, cartTotal, changeQty, toOrderItems, type Cart } from "./lib/cart";
import { kitchenOrders, mergeOrder, riderOrders, type Order, type RiderAction } from "./lib/kitchen";
import { useLiveOrders } from "./lib/useLiveOrders";
import { loadMenu, type Dish } from "./lib/menu";
import { addEvent, changeStatus, orderDeps, placeOrder, PlaceError, type PlacedOrder } from "./lib/orders";
import { ensureSession, fetchMenuRows, getClient } from "./lib/supabase";
import { currentSession, joinCode, joinLink, joinSession, rememberJoin, resetSession } from "./lib/session";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { BillScreen } from "./screens/BillScreen";
import { PlacedScreen } from "./screens/PlacedScreen";
import { KitchenScreen } from "./screens/KitchenScreen";
import { RiderScreen } from "./screens/RiderScreen";
import { useOps } from "./lib/useOps";
import { OpsScreen } from "./screens/OpsScreen";
import { DemoBar } from "./screens/DemoBar";
import { AUTOPILOT_MS, demoDecisions, demoOrder, nextAutoAction } from "./lib/autopilot";

type Step = "menu" | "cart" | "bill" | "placed";
type Role = "customer" | "kitchen" | "rider" | "split" | "ops";

const api = orderDeps;

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  // The live list runs for the kitchen, the rider, and the customer while the tracker is on screen.
  // A device that opened a ?join= link joins that session first; the live list waits for it (story #52).
  const [ready, setReady] = useState(() => !joinCode(window.location.search));
  // Autopilot (story #53): 'demo' is the offline story played from local data; 'auto' is the autopilot moving a real order.
  const [auto, setAuto] = useState(false);
  const [demo, setDemo] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const live = useLiveOrders(ready && !demo && (auto || role === "kitchen" || role === "rider" || role === "split" || role === "ops" || (role === "customer" && step === "placed")));
  const { orders, setOrders } = live;
  const ops = useOps(ready && !demo && role === "ops", orders, api);   // the offline story never asks the server
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  // The tracker goes back to the menu when the order it showed has left the list (the other device reset the demo).
  const trackedSeen = useRef(false);
  useEffect(() => {
    if (!placed) return void (trackedSeen.current = false);
    if (orders.some((o) => o.id === placed.id)) trackedSeen.current = true;
    else if (trackedSeen.current) {
      trackedSeen.current = false;
      setPlaced(null);
      setStep("menu");
    }
  }, [orders, placed]);

  useEffect(() => {
    const code = joinCode(window.location.search);
    if (!code) return;
    (async () => {
      try {
        await ensureSession();
        await joinSession(getClient(), code);
        rememberJoin(code);
      } catch (e) {
        live.setError(e instanceof Error ? e.message : "Could not join that demo.");
      } finally {
        window.history.replaceState(null, "", window.location.pathname);
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    loadMenu(fetchMenuRows, window.localStorage).then(setMenu, (e: Error) => setMenuError(e.message));
  }, []);

  // One tap for the kitchen and the rider: a status step or an event, sent as that role. The answer's updated_at decides which copy is newer.
  // Returns null when it worked, or the error code. The offline demo changes the local copy only and sends nothing.
  async function act(order: Order, action: { kind: "status"; to: string } | RiderAction, actor: "kitchen" | "rider"): Promise<string | null> {
    if (demo) {
      setOrders((cur) => mergeOrder(cur, { ...order, status: action.kind === "status" ? action.to : order.status, updated_at: new Date().toISOString() }));
      if (action.kind === "event") setArrived((cur) => new Set(cur).add(order.id));
      return null;
    }
    setBusyId(order.id);
    live.setError(null);
    try {
      const deps = { sessionId: order.session_id, orderId: order.id, actor };
      const { order: saved } = action.kind === "status" ? await changeStatus({ ...deps, to: action.to }, api()) : await addEvent({ ...deps, event: action.event }, api());
      setOrders((cur) => mergeOrder(cur, { ...order, status: saved.status, updated_at: saved.updated_at }));
      if (action.kind === "event") setArrived((cur) => new Set(cur).add(order.id));
      return null;
    } catch (e) {
      // "Already done" for Arriving means an earlier tap went through (the page may have been reloaded): that is success, not an error.
      if (e instanceof PlaceError && e.code === "already_done" && action.kind === "event") {
        setArrived((cur) => new Set(cur).add(order.id));
        return null;
      }
      live.setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      return e instanceof PlaceError ? e.code : "unknown";
    } finally {
      setBusyId(null);
    }
  }

  // The autopilot looks at the newest open order, does its next step, and waits. It stops after Delivered or when tapped again.
  // If the server cannot be reached it falls back to the offline story.
  const latest = useRef({ orders, arrived, loading: live.loading, failed: live.error, act });
  latest.current = { orders, arrived, loading: live.loading, failed: live.error, act };
  useEffect(() => {
    if (!auto) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const { orders: list, arrived: seen, loading, failed, act: doAct } = latest.current;
      if (loading) return void (timer = setTimeout(tick, AUTOPILOT_MS));
      const order = list.find((o) => o.status !== "delivered");
      const step = order && nextAutoAction(order.status, seen.has(order.id));
      if (!order && failed) {   // no order and the list could not be read: the network is down
        startOffline();
        return void (timer = setTimeout(tick, AUTOPILOT_MS));
      }
      if (!order || !step) {
        setAuto(false);
        setAutoNote(order ? null : "Place an order first.");
        return;
      }
      const code = await doAct(order, step.kind === "status" ? { kind: "status", to: step.to } : { kind: "event", event: step.event, label: "" }, step.actor);
      if (!alive) return;
      if (code === "network") startOffline();   // the loop goes on, now with the local copy
      else if (code) return void setAuto(false);   // any other refusal (kill switch, inactive webhook): stop and leave the reason on screen
      timer = setTimeout(tick, AUTOPILOT_MS);
    };
    timer = setTimeout(tick, AUTOPILOT_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [auto]);

  function startOffline() {
    const o = demoOrder();
    live.setError(null);
    setDemo(true);
    setOrders([o]);
    setArrived(new Set());
    setPlaced({ id: o.id, status: o.status, total_paise: o.total_paise, updated_at: o.updated_at });
    setStep("placed");
    setRole("customer");
    setAutoNote(null);
    setAuto(true);
  }
  function toggleAuto() {
    setAutoNote(null);
    if (auto || demo) {   // tapped again: stop, and leave the demo
      setAuto(false);
      if (demo) {
        setDemo(false);
        setOrders([]);
        setPlaced(null);
        setStep("menu");
        setArrived(new Set());
      }
    } else if (!navigator.onLine) startOffline();
    else setAuto(true);
  }

  async function reset() {
    await resetSession(getClient(), await currentSession());
    setOrders([]);
    live.setLags([]);
    setPlaced(null);
    setStep("menu");
    setCart({});
    setArrived(new Set());
    keyRef.current = null;
  }
  const shareLink = async () => joinLink(window.location.href, await currentSession());

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
      const sessionId = await currentSession();
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

  const kitchenView = (
    <KitchenScreen orders={kitchenOrders(orders)} loading={live.loading} error={live.error} busyId={busyId}
      onStep={(o, to) => act(o, { kind: "status", to }, "kitchen")} />
  );
  const customerView = (
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
        {step === "placed" && placed && <PlacedScreen order={placed} status={orders.find((o) => o.id === placed.id)?.status ?? placed.status} onAgain={() => { setPlaced(null); setStep("menu"); }} />}
    </>
  );

  return (
    <main className={role === "split" ? "shell split" : "shell"}>
      <h1>GoServe</h1>
      <nav className="roles" aria-label="Screen">
        {(["customer", "kitchen", "rider", "split", "ops"] as const).map((r) => (
          <button key={r} type="button" className={role === r ? "btn" : "btn ghost"} aria-pressed={role === r} onClick={() => setRole(r)}>
            {r === "customer" ? "Customer" : r === "kitchen" ? "Kitchen" : r === "rider" ? "Rider" : r === "split" ? "Split" : "Ops"}
          </button>
        ))}
      </nav>
      {demo && <p role="status" className="notice"><strong>Offline demo</strong></p>}
      <DemoBar onReset={reset} getLink={shareLink} autoOn={auto || demo} autoNote={autoNote} onAuto={toggleAuto} />
      {role === "kitchen" && kitchenView}
      {role === "rider" && (
        <RiderScreen orders={riderOrders(orders)} loading={live.loading} error={live.error} busyId={busyId} arrived={arrived}
          onAct={(o, a) => act(o, a, "rider")} />
      )}
      {role === "ops" && <OpsScreen orders={orders} decisions={demo ? (orders.some((o) => ["ready", "out_for_delivery", "delivered"].includes(o.status)) ? demoDecisions() : []) : ops.decisions} lags={demo ? [800] : live.lags}
        stats={demo ? { runsToday: 6, lastDecideMs: 310 } : ops.stats} error={demo ? null : ops.error ?? live.error} failed={ops.failed} sample={demo} />}
      {role === "customer" && customerView}
      {role === "split" && (
        <div className="panes">
          <div>{customerView}</div>
          <div>{kitchenView}</div>
        </div>
      )}
    </main>
  );
}
