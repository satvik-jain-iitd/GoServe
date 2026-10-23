// The customer flow in one place: menu, cart, bill, placed (story #48). No router yet: four steps in state.
import { useEffect, useMemo, useRef, useState } from "react";
import { addDish, cartLines, cartTotal, changeQty, toOrderItems, type Cart } from "./lib/cart";
import { kitchenOrders, mergeOrder, riderOrders, type Order, type RiderAction } from "./lib/kitchen";
import { useLiveOrders } from "./lib/useLiveOrders";
import { loadMenu, MENU_KEY, type Dish } from "./lib/menu";
import { fetchKitchens, forgetArea, loadPin, resolveArea, savePin, type Area } from "./lib/area";
import { AreaScreen } from "./screens/AreaScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { loadProfile, saveProfile } from "./lib/profile";
import { addEvent, changeStatus, confirmDelivery, orderDeps, placeOrder, PlaceError, sendFeedback, type PlacedOrder } from "./lib/orders";
import { confirmAt, DEFAULT_CFG, notYet, reaskMs, type ConfirmCfg } from "./lib/confirm";
import { pushTrail } from "./lib/trail";
import { FeedbackSheet } from "./screens/FeedbackSheet";
import { ensureSession, fetchMenuRows, getClient } from "./lib/supabase";
import { currentSession, joinCode, joinLink, joinSession, rememberJoin, resetSession } from "./lib/session";
import { MenuScreen } from "./screens/MenuScreen";
import { CartScreen } from "./screens/CartScreen";
import { BillScreen } from "./screens/BillScreen";
import { openOrderToResume } from "./lib/resume";
import { SignIn } from "./screens/SignIn";
import { AdminScreen } from "./screens/AdminScreen";
import { loadDraft, saveDraft } from "./lib/draft";
import { PlacedScreen } from "./screens/PlacedScreen";
import { KitchenScreen } from "./screens/KitchenScreen";
import { RiderScreen } from "./screens/RiderScreen";
import { useOps } from "./lib/useOps";
import { OpsScreen } from "./screens/OpsScreen";
import { DemoBar } from "./screens/DemoBar";
import { AUTOPILOT_MS, demoDecisions, demoOrder, nextAutoAction } from "./lib/autopilot";

type Step = "menu" | "cart" | "bill" | "placed" | "orders";
type Role = "customer" | "kitchen" | "rider" | "split" | "ops" | "admin";

const api = orderDeps;

// `lock` makes this one of the role apps (story #83): that role only, no role tabs, no demo tools. Without it, this is the demo console.
export function App({ lock }: { lock?: Exclude<Role, "split"> } = {}) {
  const [menu, setMenu] = useState<{ dishes: Dish[]; fromCache: boolean } | null>(null);
  // The customer app asks for a pin code and shows the menu of the kitchen that serves it (story B2). The demo console and the other apps keep the plain menu.
  const [pin, setPin] = useState<string | null>(() => (lock === "customer" ? loadPin() : null));
  const [area, setArea] = useState<Area | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  // The customer app keeps an unfinished order across a refresh (story B1); the demo console and the other apps start fresh.
  const [draft0] = useState(() => (lock === "customer" ? loadDraft() : null));
  const [step, setStep] = useState<Step>(draft0 && draft0.step !== "placed" && draft0.step !== "orders" ? draft0.step : "menu");
  const [cart, setCart] = useState<Cart>(draft0?.cart ?? {});
  const [address, setAddress] = useState(draft0?.address ?? "");
  const [name, setName] = useState(draft0?.name ?? "");
  const [phone, setPhone] = useState(draft0?.phone ?? "");
  useEffect(() => {
    if (lock === "customer") saveDraft({ step, cart, address, name, phone });
  }, [lock, step, cart, address, name, phone]);
  // Saved details come back on the next visit (story B3); what the customer already typed this time is kept.
  useEffect(() => {
    if (lock !== "customer") return;
    ensureSession().then(() => loadProfile(getClient())).then((p) => {
      if (!p) return;
      setName((v) => v || p.name);
      setPhone((v) => v || p.phone);
      setAddress((v) => v || p.address);
    }).catch(() => {});
  }, [lock]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [role, setRole] = useState<Role>(lock ?? "customer");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  // The live list runs for the kitchen, the rider, and the customer while the tracker is on screen.
  // A device that opened a ?join= link joins that session first; the live list waits for it (story #52).
  const [ready, setReady] = useState(() => !joinCode(window.location.search));
  // Autopilot (story #53): 'demo' is the offline story played from local data; 'auto' is the autopilot moving a real order.
  const [auto, setAuto] = useState(false);
  const [demo, setDemo] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);   // only the customer app (not the demo console) looks once, at load, for an order that is still open
  const live = useLiveOrders(ready && !demo && (auto || role === "kitchen" || role === "rider" || role === "split" || role === "ops" || (role === "customer" && (step === "placed" || step === "orders" || (lock === "customer" && !resumed)))), lock === "kitchen" || lock === "rider");
  const { orders, setOrders } = live;
  const sawLoading = useRef(false);
  useEffect(() => {
    if (resumed || lock !== "customer" || demo) return;
    if (live.loading) return void (sawLoading.current = true);
    if (!sawLoading.current) return;   // the first render comes before the load starts
    setResumed(true);
    const open = openOrderToResume(orders);
    if (open && step === "menu" && !placed) {
      setPlaced({ id: open.id, status: open.status, total_paise: open.total_paise, updated_at: open.updated_at, paid_by: open.paid_by ?? null });
      setPlacedAt(open.created_at);
      setStep("placed");
    }
  }, [live.loading, orders, resumed, lock, demo, step, placed]);
  const ops = useOps(ready && !demo && role === "ops", orders, api);   // the offline story never asks the server
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  // Delivered by hand (story S-C): the delivery question for the customer's order, the Yes, and the Not yet.
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg>(DEFAULT_CFG);
  const [placedAt, setPlacedAt] = useState(() => new Date().toISOString());
  const [asking, setAsking] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [preset, setPreset] = useState<{ nonce: number; text: string; doing: "ordering" } | undefined>();
  const notYetCount = useRef(0);
  const askingRef = useRef(false);
  askingRef.current = asking;
  const [reminder, setReminder] = useState<"ask" | "on" | "none">(() => (typeof Notification === "undefined" ? "none" : Notification.permission === "default" ? "ask" : Notification.permission === "granted" ? "on" : "none"));
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

  const tracked = placed ? orders.find((o) => o.id === placed.id) ?? { status: placed.status, created_at: placedAt, updated_at: placed.updated_at, paid_by: placed.paid_by ?? null } : null;
  useEffect(() => {
    if (!tracked || demo) return void setAsking(false);
    const check = () => {
      const due = confirmAt(tracked, confirmCfg);
      if (due === null) return void setAsking(false);
      if (Date.now() >= Math.max(due, snoozeUntil)) {
        if (!askingRef.current) remind();
        setAsking(true);
      }
    };
    check();
    const timer = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [placed?.id, tracked?.status, tracked?.updated_at, tracked?.created_at, confirmCfg, snoozeUntil, demo]);

  // The phone also shows a notification when the question comes, if the tester allowed it. Some phones only allow it through the service worker.
  function remind() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification("Was your order delivered?");
    } catch {
      navigator.serviceWorker?.ready.then((r) => r.showNotification("Was your order delivered?")).catch(() => undefined);
    }
  }
  function allowReminder() {
    Notification.requestPermission().then((p) => setReminder(p === "granted" ? "on" : "none"), () => setReminder("none"));
  }
  async function yes() {
    if (!placed) return;
    pushTrail("customer: yes, delivered");
    setConfirming(true);
    setConfirmError(null);
    try {
      const { order: saved } = await confirmDelivery({ sessionId: await currentSession(), orderId: placed.id }, api());
      setOrders((cur) => (cur.some((o) => o.id === saved.id) ? mergeOrder(cur, { ...cur.find((o) => o.id === saved.id)!, status: saved.status, updated_at: saved.updated_at, paid_by: saved.paid_by ?? null }) : cur));
      setPlaced({ ...placed, status: saved.status, updated_at: saved.updated_at, paid_by: saved.paid_by ?? null });
      setAsking(false);
    } catch (e) {
      pushTrail(`error: ${e instanceof Error ? e.message : "confirm failed"}`);
      setConfirmError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setConfirming(false);
    }
  }
  function notYetTap() {
    const n = ++notYetCount.current;
    pushTrail(`customer: not yet (${n})`);
    const next = notYet(n, Date.now(), reaskMs());
    setAsking(false);
    if (next.feedback) {
      setSnoozeUntil(Number.MAX_SAFE_INTEGER);   // the question stops; the Feedback sheet takes over
      setPreset({ nonce: Date.now(), text: "Order not delivered", doing: "ordering" });
    } else setSnoozeUntil(next.askAgainAt!);
  }

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
    if (lock !== "customer") return void loadMenu(() => fetchMenuRows(), window.localStorage).then(setMenu, (e: Error) => setMenuError(e.message));
    if (!pin) return;
    let alive = true;
    setLooking(true);
    setAreaError(null);
    resolveArea(pin, () => fetchKitchens(getClient()), window.localStorage)
      .then(async (found) => {
        if (!alive) return;
        setArea(found);
        if (found.kind !== "ok") return;
        try {
          const loaded = await loadMenu(() => fetchMenuRows(found.kitchen.id), window.localStorage, `${MENU_KEY}.${found.kitchen.id}`);
          if (alive) setMenu(loaded);
        } catch (e) {
          if (alive) setMenuError((e as Error).message);
        }
      }, () => { if (alive) setAreaError("Could not look up kitchens. Connect and try again."); })
      .finally(() => { if (alive) setLooking(false); });
    return () => { alive = false; };
  }, [lock, pin]);
  function choosePin(p: string) {
    savePin(p);
    setArea(null);
    setMenu(null);
    setMenuError(null);
    setPin(p);
    ensureSession().then((uid) => getClient().from("customers").upsert({ user_id: uid, pin_code: p, updated_at: new Date().toISOString() }, { onConflict: "user_id" })).catch(() => {});
  }
  function changeArea() {
    forgetArea();
    setPin(null);
    setArea(null);
    setMenu(null);
    setCart({});
  }

  // One tap for the kitchen and the rider: a status step or an event, sent as that role. The answer's updated_at decides which copy is newer.
  // Returns null when it worked, or the error code. The offline demo changes the local copy only and sends nothing.
  async function act(order: Order, action: { kind: "status"; to: string } | RiderAction, actor: "kitchen" | "rider"): Promise<{ code: string; message: string } | null> {
    if (demo) {
      setOrders((cur) => mergeOrder(cur, { ...order, status: action.kind === "status" ? action.to : order.status, updated_at: new Date().toISOString() }));
      if (action.kind === "event") setArrived((cur) => new Set(cur).add(order.id));
      return null;
    }
    setBusyId(order.id);
    live.setError(null);
    pushTrail(`${actor}: ${action.kind === "status" ? action.to : action.event}`);
    try {
      const deps = { sessionId: order.session_id, orderId: order.id, actor };
      const { order: saved } = action.kind === "status" ? await changeStatus({ ...deps, to: action.to }, api()) : await addEvent({ ...deps, event: action.event }, api());
      setOrders((cur) => mergeOrder(cur, { ...order, status: saved.status, updated_at: saved.updated_at }));
      if (action.kind === "event") setArrived((cur) => new Set(cur).add(order.id));
      return null;
    } catch (e) {
      // "Already done" for Arriving means an earlier tap went through (the page may have been reloaded): that is success, not an error.
      if (e instanceof PlaceError && e.code === "already_done") {
        if (action.kind === "event") setArrived((cur) => new Set(cur).add(order.id));
        return null;
      }
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      pushTrail(`error: ${message}`);
      live.setError(message);
      return { code: e instanceof PlaceError ? e.code : "unknown", message };
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
      const failure = await doAct(order, step.kind === "status" ? { kind: "status", to: step.to } : { kind: "event", event: step.event, label: "" }, step.actor);
      if (!alive) return;
      if (failure?.code === "network") startOffline();   // the loop goes on, now with the local copy
      else if (failure) {   // any other refusal (kill switch, inactive webhook): stop, and keep the reason where the founder looks
        setAutoNote(failure.message);
        return void setAuto(false);
      }
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
    pushTrail(auto || demo ? "autopilot off" : "autopilot on");
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
    pushTrail("reset demo");
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

  const [cancelling, setCancelling] = useState(false);
  // The customer cancels while the order is still placed (story B3). The database checks the rule; the live list brings the new status.
  async function cancelOrder() {
    if (!placed) return;
    setCancelling(true);
    setConfirmError(null);
    const { data, error: failed } = await getClient().rpc("cancel_order", { p_order: placed.id, p_reason: null });
    if (failed) setConfirmError("This order can no longer be cancelled.");
    else if (data?.order) setOrders((cur) => mergeOrder(cur, data.order as Order));
    setCancelling(false);
  }

  async function place() {
    pushTrail("place order");
    setSending(true);
    setError(null);
    try {
      const items = toOrderItems(cart);
      const fingerprint = JSON.stringify([items, address.trim()]);
      if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: crypto.randomUUID() };
      const sessionId = await currentSession();
      if (lock === "customer" && !(await saveProfile(getClient(), await ensureSession(), { name, phone, address, pin }))) {   // the kitchen and the rider need the name and phone; place_order copies them
        setError("Could not save your details. Try again.");
        return;
      }
      const { order, confirm } = await placeOrder(
        { sessionId, key: keyRef.current.key, items, address: address.trim() },
        api(),
      );
      setPlaced(order);
      setConfirmCfg(confirm);
      setPlacedAt(new Date().toISOString());
      setAsking(false);
      setSnoozeUntil(0);
      setConfirmError(null);
      notYetCount.current = 0;
      setStep("placed");
      setCart({});
      keyRef.current = null;
    } catch (e) {
      pushTrail(`error: ${e instanceof Error ? e.message : "place failed"}`);
      setError(e instanceof PlaceError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const kitchenView = (
    <KitchenScreen orders={kitchenOrders(orders)} loading={live.loading} error={live.error} busyId={busyId}
      onStep={(o, to) => act(o, { kind: "status", to }, "kitchen")} />
  );
  const needArea = lock === "customer" && step !== "placed" && step !== "orders" && !(pin && area?.kind === "ok");
  const customerView = needArea ? (
    <AreaScreen pin={pin} area={area} busy={looking} error={areaError} onPin={choosePin} />
  ) : (
    <>
        {lock === "customer" && step === "menu" && area?.kind === "ok" && (
          <div><h2>{area.kitchen.name}</h2><button type="button" className="btn ghost small" onClick={changeArea}>Change area</button> <button type="button" className="btn ghost small" onClick={() => setStep("orders")}>My orders</button></div>
        )}
        {menuError && <p role="alert" className="error">{menuError}</p>}
        {!menu && !menuError && <p>Loading the menu…</p>}
        {menu && step === "menu" && (
          <MenuScreen dishes={menu.dishes} fromCache={menu.fromCache} cartCount={count}
            onAdd={(id) => setCart((c) => addDish(c, id))} onOpenCart={() => setStep("cart")} />
        )}
        {step === "orders" && <OrdersScreen orders={orders} loading={live.loading} onBack={() => setStep("menu")} />}
        {menu && step === "cart" && (
          <CartScreen lines={lines} address={address} onAddress={setAddress} details={lock === "customer" ? { name, phone, onName: setName, onPhone: setPhone } : undefined} onChange={(id, d) => setCart((c) => changeQty(c, id, d))}
            onBack={() => setStep("menu")} onReview={() => { setError(null); setStep("bill"); }} />
        )}
        {menu && step === "bill" && (
          <BillScreen lines={lines} total={total} address={address.trim()} sending={sending} error={error}
            onBack={() => setStep("cart")} onPlace={place} />
        )}
        {step === "placed" && placed && (
          <PlacedScreen order={placed} status={tracked?.status ?? placed.status} paidBy={tracked?.paid_by ?? null}
            confirmedAt={tracked && tracked.status === "delivered" ? tracked.updated_at : null}
            asking={asking} busy={confirming} error={confirmError} reminder={reminder}
            onYes={yes} onNotYet={notYetTap} onAllowReminder={allowReminder} onAgain={() => { setPlaced(null); setStep("menu"); }} onCancel={cancelOrder} cancelling={cancelling} />
        )}
    </>
  );

  return (
    <>
    <main className={role === "split" ? "shell split" : "shell"}>
      <h1>{lock && lock !== "customer" ? `GoServe ${lock[0].toUpperCase()}${lock.slice(1)}` : "GoServe"}</h1>
      {!demo && <SignIn mode={lock && lock !== "customer" ? "signin" : "link"} />}
      {!lock && <nav className="roles" aria-label="Screen">
        {(["customer", "kitchen", "rider", "split", "ops"] as const).map((r) => (
          <button key={r} type="button" className={role === r ? "btn" : "btn ghost"} aria-pressed={role === r} onClick={() => { pushTrail(`open ${r} tab`); setRole(r); }}>
            {r === "customer" ? "Customer" : r === "kitchen" ? "Kitchen" : r === "rider" ? "Rider" : r === "split" ? "Split" : "Ops"}
          </button>
        ))}
      </nav>}
      {demo && <p role="status" className="notice"><strong>Offline demo</strong></p>}
      {!lock && <DemoBar onReset={reset} getLink={shareLink} autoOn={auto || demo} autoNote={autoNote} onAuto={toggleAuto} />}
      {role === "kitchen" && kitchenView}
      {role === "rider" && (
        <RiderScreen orders={riderOrders(orders)} loading={live.loading} error={live.error} busyId={busyId} arrived={arrived}
          onAct={(o, a) => act(o, a, "rider")} />
      )}
      {role === "ops" && <OpsScreen orders={orders} decisions={demo ? (orders.some((o) => ["ready", "out_for_delivery", "delivered"].includes(o.status)) ? demoDecisions() : []) : ops.decisions} lags={demo ? [800] : live.lags}
        stats={demo ? { runsToday: 6, lastDecideMs: 310 } : ops.stats} error={demo ? null : ops.error ?? live.error} failed={ops.failed} sample={demo} />}
      {role === "customer" && customerView}
      {role === "admin" && <AdminScreen />}
      <FeedbackSheet role={lock ?? "console"} screen={`${window.location.pathname}${lock ? "" : ` (${role} tab)`}`}
        order={placed ? { id: placed.id, status: orders.find((o) => o.id === placed.id)?.status ?? placed.status } : orders[0] ? { id: orders[0].id, status: orders[0].status } : null}
        getSession={currentSession} send={(r) => sendFeedback(r, api())} preset={preset} />
      {role === "split" && (
        <div className="panes">
          <div>{customerView}</div>
          <div>{kitchenView}</div>
        </div>
      )}
    </main>
      <footer className="legal">
        <p>GoServe: order food, the kitchen cooks, a rider brings it</p>
        <p><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p>
      </footer>
    </>
  );
}
