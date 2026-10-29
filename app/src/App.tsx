// The customer flow in one place: menu, cart, bill, placed (story #48). No router yet: four steps in state.
import { useEffect, useMemo, useRef, useState } from "react";
import { addDish, cartLines, cartTotal, changeQty, toOrderItems, type Cart } from "./lib/cart";
import { mergeOrder, riderOrders, shortId, statusLabel, type Order, type RiderAction, confirmHandover, isCash } from "./lib/kitchen";
import { clientPlatform } from "./lib/platform";
import { riderRefused, savePlatform, tapCall } from "./lib/signals";
import { useLiveOrders } from "./lib/useLiveOrders";
import { loadMenu, MENU_KEY, type Dish } from "./lib/menu";
import { fetchKitchens, forgetArea, loadArea, loadPin, closedLine, openingText, resolveArea, savePin, shownArea, type Area } from "./lib/area";
import { AreaScreen } from "./screens/AreaScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { AdminGate } from "./screens/AdminGate";
import { RiderGate } from "./screens/RiderGate";
import { fetchKitchen, type KitchenCard, type RiderGateState } from "./lib/rider";
import { KitchenGate, type KitchenGateState } from "./screens/KitchenGate";
import { enablePush, watchSession } from "./lib/push";
import { takeReturn } from "./lib/auth";
import { alertsState, readOff, turnAlertsOff, writeOff, type Alerts } from "./lib/alerts";
import { loadProfile, saveProfile } from "./lib/profile";
import { capture } from "./lib/analytics";
import { addEvent, changeStatus, confirmDelivery, orderDeps, placeOrder, PlaceError, sendFeedback, type PlacedOrder } from "./lib/orders";
import { confirmAt, DEFAULT_CFG, mayAsk, notYet, reaskMs, type ConfirmCfg } from "./lib/confirm";
import { fetchOrders } from "./lib/live";
import { pushTrail } from "./lib/trail";
import { trace } from "./lib/trace";
import { NO_INTERNET } from "./lib/errorLines";
import { FeedbackSheet } from "./screens/FeedbackSheet";
import { ensureSession, fetchMenuRows, fetchRiderCard, getClient, type RiderCard } from "./lib/supabase";
import { openTill } from "./lib/browse";
import { AccountScreen } from "./screens/AccountScreen";
import { currentSession, scopeFor, joinCode, joinLink, joinSession, rememberJoin, resetSession } from "./lib/session";
import { MenuScreen } from "./screens/MenuScreen";
import { BillScreen } from "./screens/BillScreen";
import { OFFERS_ON } from "./lib/quote";
import { ordersV2On, placeOrderV2, PriceChanged, v2Deps } from "./lib/ordersV2";
import { useOffers } from "./lib/useOffers";
import { openOrderToResume } from "./lib/resume";
import { SignIn } from "./screens/SignIn";
import { NameSheet, OtpSheet } from "./screens/OtpSheet";
import { Skeleton } from "./ui";
import { otpGateOn } from "./lib/otpGate";
import { createPayment, switchToCash, simulatePaid, type PayMethod } from "./lib/payments";
import { openGateway } from "./lib/payGateway";
import { registerNative, wrapperToken } from "./lib/pushNative";
import { AdminScreen } from "./screens/AdminScreen";
import { loadDraft, saveDraft } from "./lib/draft";
import { PlacedScreen } from "./screens/PlacedScreen";
import { KitchenScreen } from "./screens/KitchenScreen";
import { RiderScreen } from "./screens/RiderScreen";
import { useOps } from "./lib/useOps";
import { OpsScreen } from "./screens/OpsScreen";
import { DemoBar } from "./screens/DemoBar";
import { AUTOPILOT_MS, demoDecisions, demoOrder, nextAutoAction } from "./lib/autopilot";

type Step = "menu" | "bill" | "placed" | "orders" | "account";
type Role = "customer" | "kitchen" | "rider" | "split" | "ops" | "admin";

const api = orderDeps;

// `lock` makes this one of the role apps (story #83): that role only, no role tabs, no demo tools. Without it, this is the demo console.
export function App({ lock }: { lock?: Exclude<Role, "split"> } = {}) {
  const [menu, setMenu] = useState<{ dishes: Dish[]; fromCache: boolean } | null>(null);
  // The customer app asks for a pin code and shows the menu of the kitchen that serves it (story B2). The demo console and the other apps keep the plain menu.
  const land = useRef(false);
  const [pin, setPin] = useState<string | null>(() => (lock === "customer" ? loadPin() : null));
  const [area, setArea] = useState<Area | null>(() => (lock === "customer" ? loadArea() : null));   // #242 D15: a saved kitchen opens the menu before the network answers
  const [areaError, setAreaError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());   // #321: the kitchen's hours are checked against this, so the menu closes at closing time without a reload
  useEffect(() => {
    if (lock !== "customer") return;
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, [lock]);
  const shown = shownArea(area, clock);
  const [looking, setLooking] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [from, setFrom] = useState<{ lat: number; lng: number } | null>(null);   // story #668: where the customer is, when they allowed location; it picks the nearest kitchen
  const [menuTry, setMenuTry] = useState(0);   // story #637: Try again and the phone coming back online read the menu again
  useEffect(() => {
    const again = () => setMenuTry((n) => n + 1);
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, []);
  // The customer app keeps an unfinished order across a refresh (story B1); the demo console and the other apps start fresh.
  const [draft0] = useState(() => (lock === "customer" ? loadDraft() : null));
  const [step, setStep] = useState<Step>(lock === "customer" && takeReturn() ? "account" : draft0 && draft0.step !== "placed" && draft0.step !== "orders" ? draft0.step === "cart" ? "bill" : (draft0.step as Step) : "menu");   // an older draft may hold the cart step: the bill replaced it (H10c)
  const [cart, setCart] = useState<Cart>(draft0?.cart ?? {});
  const [address, setAddress] = useState(draft0?.address ?? "");
  const [name, setName] = useState(draft0?.name ?? "");
  const [phone, setPhone] = useState(draft0?.phone ?? "");
  // Story #551: the phone code at checkout (off unless the gate is on). verified = this user already has a phone linked.
  const gate = lock === "customer" && otpGateOn(import.meta.env, window.localStorage);
  const ordersV2 = lock === "customer" && ordersV2On(import.meta.env, window.localStorage);   // story #590: POST /orders instead of the v1 webhook
  const [verified, setVerified] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);   // story #667: null = not asked yet; the first screen waits so a returning customer never sees it flash
  const [otpOpen, setOtpOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameAsked, setNameAsked] = useState(false);
  const [pendingPlace, setPendingPlace] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Story #552: how you pay. cod = today's cash order. UPI or Card: the order is placed, then Pay now makes the payment (the state machine lives here).
  const [payMethod, setPayMethod] = useState<PayMethod>("cod");
  const [payState, setPayState] = useState<"ready" | "starting" | "waiting" | "failed" | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payStart, setPayStart] = useState<string | null>(null);
  const payRef = useRef("");
  useEffect(() => {
    if (lock === "customer") saveDraft({ step: step === "account" ? "menu" : step, cart, address, name, phone });
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
  const live = useLiveOrders(ready && !demo && (auto || role === "kitchen" || role === "rider" || role === "split" || role === "ops" || (role === "customer" && (step === "placed" || step === "orders" || (lock === "customer" && !resumed)))), lock === "kitchen" || lock === "rider" ? lock : undefined);
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
  const [placedLines, setPlacedLines] = useState<{ name: string; qty: number; paise: number }[]>([]);   // what the bill showed, for the slip until the live copy arrives
  const [asking, setAsking] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [preset, setPreset] = useState<{ nonce: number; text: string; doing: "ordering" } | undefined>();
  const notYetCount = useRef(0);
  const askingRef = useRef(false);
  const checkingRef = useRef(false);
  askingRef.current = asking;
  // Story #484: a line in order_trace for what this phone did, on the newest order. Fire and forget.
  const track = (event: string, result?: string, text?: string) => {
    try {
      void trace(getClient(), placed?.id ?? orders[0]?.id ?? null, event, result, text);
    } catch { /* no database address (the offline story): no line */ }
  };
  const trackRef = useRef(track);
  trackRef.current = track;
  useEffect(() => {
    if (live.loading) return;
    trackRef.current("app_open", document.visibilityState);
    const seen = () => document.visibilityState === "visible" && trackRef.current("app_visible");
    document.addEventListener("visibilitychange", seen);
    return () => document.removeEventListener("visibilitychange", seen);
  }, [live.loading]);
  const [reminder, setReminder] = useState<Alerts>(() => alertsState(typeof Notification === "undefined" ? undefined : Notification.permission, readOff(window.localStorage)));   // story #609: on, off (by the customer), ask, or none (blocked)
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
  // Story #552: paid when the order row says so; a waiting payment that the database moved back to cash (it expired) is failed; a refresh of an online order waits without a clock.
  const trackedPay = tracked as { payment_method?: string | null; paid_at?: string | null } | null;
  const paidNow = !!trackedPay?.paid_at;
  const resumedOnline = payState === null && trackedPay?.payment_method === "online" && !paidNow;
  useEffect(() => {
    if (payState === "waiting" && trackedPay?.payment_method === "cod") setPayState("failed");
  }, [payState, trackedPay?.payment_method]);
  async function payNow() {
    if (!placed) return;
    const before = payState === "failed" ? "failed" : "ready";
    setPayState("starting");
    setPayError(null);
    const made = await createPayment(placed.id);
    if (!made.ok) { setPayState(before); setPayError(made.message); return; }
    payRef.current = made.provider_order_id;
    await openGateway(made, import.meta.env).catch(() => undefined);
    setPayState("waiting");
  }
  async function payCash() {
    if (!placed) return;
    setPayError(null);
    const r = await switchToCash(placed.id);
    if (!r.ok) return void setPayError(r.message);
    setPayState(null);
    setPayMethod("cod");
  }
  useEffect(() => {
    if (!tracked || demo) return void setAsking(false);
    const check = () => {
      const due = confirmAt(tracked, confirmCfg);
      if (due === null) return void setAsking(false);
      if (Date.now() >= Math.max(due, snoozeUntil)) {
        if (askingRef.current) return void setAsking(true);
        // Story #501: a hidden app holds a stale status. Ask only when it is visible and a fresh read says the order is still open.
        if (document.visibilityState !== "visible" || checkingRef.current) return;
        checkingRef.current = true;
        void freshStatus(placed?.id).then((st) => {
          checkingRef.current = false;
          if (!mayAsk(document.visibilityState === "visible", st)) return;
          trackRef.current("delivered_asked", typeof Notification === "undefined" ? "no_notification_api" : Notification.permission, document.visibilityState);
          remind();
          setAsking(true);
        });
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

  // The server's own word on this order, read just before the question (story #501). null: the read failed.
  async function freshStatus(id: string | undefined): Promise<string | null> {
    if (!id) return null;
    try {
      const rows = await fetchOrders(getClient(), scopeFor(null, await currentSession()));
      return rows.find((o) => o.id === id)?.status ?? null;
    } catch {
      return null;
    }
  }
  // The phone also shows a notification when the question comes, if the tester allowed it. Some phones only allow it through the service worker.
  // Story #501: with a push subscription the server push already tells the customer; a second local notice would repeat it. No answer in half a second counts as none.
  async function hasPush(): Promise<boolean> {
    try {
      const sub = await Promise.race([navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()), new Promise<null>((done) => setTimeout(() => done(null), 500))]);
      return !!sub;
    } catch {
      return false;
    }
  }
  async function remind() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (await hasPush()) return void trackRef.current("local_notice", "skipped_push");
    try {
      new Notification("Was your order delivered?");
    } catch {
      navigator.serviceWorker?.ready.then((r) => r.showNotification("Was your order delivered?")).catch(() => undefined);
    }
  }
  // One tap allows the local reminder and, where the phone can, the web push (story A7), so the customer hears about placed, ready and delivered with the app closed.
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const ALERTS_FAILED = "Could not turn alerts on. Try again in a minute.";
  async function allowReminder() {
    setAlertsError(null);
    writeOff(window.localStorage, false);
    const native = await wrapperToken(window);   // story #554: a phone wrapper also registers its device token, with its platform
    if (native && !(await registerNative(native))) return void setAlertsError(ALERTS_FAILED);
    void pushWith(() => Notification.requestPermission()).then((r) => {
      track("push_subscribe", r, typeof Notification === "undefined" ? "no_notification_api" : Notification.permission);
      if (r === "denied") return setReminder("none");
      if (r === "unsupported") return void Notification.requestPermission().then((p) => setReminder(p === "granted" ? "on" : "none"), () => setReminder("none"));
      if (r === "not_set_up") return void Notification.requestPermission().then((p) => (p === "granted" ? setAlertsError(ALERTS_FAILED) : setReminder("none")), () => setReminder("none"));   // story #661: permission given but the set-up did not work: say so, the switch stays off
      if (r === "failed") return setAlertsError(ALERTS_FAILED);
      setReminder("on");
    });
  }
  // Story #609: the switch on You always works. Off: the server row and the browser subscription go and "off" is remembered. On again: subscribe with no prompt (the permission is still granted).
  async function toggleAlerts() {
    if (reminder === "ask" || reminder === "none") return allowReminder();
    setAlertsError(null);
    if (reminder === "on") {
      const r = await turnAlertsOff({
        subscription: async () => (await (await navigator.serviceWorker.ready).pushManager.getSubscription()) as { endpoint: string; unsubscribe: () => Promise<boolean> } | null,
        remove: async (endpoint) => (await getClient().from("push_subscriptions").delete().eq("endpoint", endpoint)).error?.message ?? null,
        setOff: (off) => writeOff(window.localStorage, off),
      });
      return r === "off" ? setReminder("off") : setAlertsError("Could not turn off alerts. Try again.");
    }
    writeOff(window.localStorage, false);
    const r = await pushWith(async () => "granted");
    if (r === "failed") { writeOff(window.localStorage, true); return setAlertsError(ALERTS_FAILED); }
    setReminder("on");
  }
  // The browser's subscription, saved for the current session. `permission` asks (the Allow tap) or only reads (the re-save below).
  const pushWith = (permission: () => Promise<NotificationPermission | string>) => enablePush({
    vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "",
    supported: () => "serviceWorker" in navigator && "PushManager" in window,
    permission,
    subscribe: async (key) => (await (await navigator.serviceWorker.ready).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource })),
    save: async (payload) => (await getClient().rpc("save_push", payload)).error?.message ?? null,
  });
  // Story #613: alerts already allowed on this phone: at app start and after every sign in or sign out the subscription moves to the current session, so the push is queued for its orders. Never asks.
  useEffect(() => {
    if (lock !== "customer" || typeof Notification === "undefined") return;
    return watchSession(
      (cb) => { const { data } = getClient().auth.onAuthStateChange((_e, s) => cb(s?.user.id ?? null)); return () => data.subscription.unsubscribe(); },
      () => { if (Notification.permission === "granted" && !readOff(window.localStorage)) void pushWith(async () => "granted"); },
    );
  }, [lock]);   // eslint-disable-line react-hooks/exhaustive-deps
  async function yes() {
    if (!placed) return;
    pushTrail("customer: yes, delivered");
    track("delivered_answer", "yes");
    capture("delivered_yes");
    setConfirming(true);
    setConfirmError(null);
    try {
      const answer = await confirmDelivery({ sessionId: await currentSession(), orderId: placed.id }, api());
      const saved = answer.order ?? { ...placed, status: "delivered", updated_at: new Date().toISOString() };   // "Already done": show the delivered state, no line
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
    track("delivered_answer", "not_yet", String(n));
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
    if (lock && lock !== "customer") return;   // story H2: the kitchen, rider, ops and admin apps have nothing to sell
    if (!lock) return void loadMenu(() => fetchMenuRows(), window.localStorage).then((m) => { setMenu(m); setMenuError(null); }, (e: Error) => setMenuError(e.message));
    if (!pin) return;
    let alive = true;
    setLooking(true);
    setAreaError(null);
    resolveArea(pin, () => fetchKitchens(getClient()), window.localStorage, from ?? undefined)
      .then((found) => { if (alive) setArea(found); }, () => { if (alive) setAreaError(NO_INTERNET); })
      .finally(() => { if (alive) setLooking(false); });
    return () => { alive = false; };
  }, [lock, pin, from, menuTry]);
  // The menu of the kitchen that serves the pin; a closed kitchen still shows its menu (board 02c). Reads as soon as the kitchen is known,
  // so a saved kitchen (D15, #242) shows its menu before the kitchens read answers.
  const areaKitchenId = area?.kind === "ok" ? area.kitchen.id : area?.kind === "closed" ? area.id : null;
  useEffect(() => {
    if (lock !== "customer" || !areaKitchenId) return;
    let alive = true;
    loadMenu(() => fetchMenuRows(areaKitchenId), window.localStorage, `${MENU_KEY}.${areaKitchenId}`)
      .then((loaded) => { if (alive) { setMenu(loaded); setMenuError(null); } }, (e: Error) => { if (alive) setMenuError(e.message); });
    return () => { alive = false; };
  }, [lock, areaKitchenId, menuTry]);
  function choosePin(p: string, at?: { lat: number; lng: number }) {
    setFrom(at ?? null);
    land.current = true;   // #525: the mark flies in once, on the first Menu after this pick
    savePin(p);
    capture("address_set", { from: at ? "location" : "typed" });
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
      setOrders((cur) => mergeOrder(cur, { ...order, status: action.kind === "status" ? action.to : action.kind === "refused" ? "cancelled" : order.status, updated_at: new Date().toISOString() }));
      if (action.kind === "event") setArrived((cur) => new Set(cur).add(order.id));
      return null;
    }
    setBusyId(order.id);
    live.setError(null);
    pushTrail(`${actor}: ${action.kind === "status" ? action.to : action.kind === "refused" ? "not delivered" : action.event}`);
    try {
      if (action.kind === "refused") {   // story H14: the customer refused or was not there; the database ends the order
        if (!window.confirm(`Mark order ${shortId(order.id)} as not delivered? The customer refused it or was not there.`)) return null;
        if (!(await riderRefused(getClient(), order.id))) throw new Error("Could not mark it. Try again.");
        setOrders((cur) => mergeOrder(cur, { ...order, status: "cancelled", updated_at: new Date().toISOString() }));
        return null;
      }
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

  // Story D2: the rider card appears once a rider has the order; the database answers only for this customer's own order.
  const [rider, setRider] = useState<RiderCard | null>(null);
  const riderStatus = tracked?.status;
  useEffect(() => {
    if (!placed || demo || (riderStatus !== "ready" && riderStatus !== "out_for_delivery")) return void setRider(null);
    let alive = true;
    void fetchRiderCard(placed.id).then((r) => { if (alive) setRider(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, [placed?.id, riderStatus, demo]);

  // A tap on a slip of "Your orders" opens it as the tracker or the delivered screen (story H10d).
  function openOrder(o: Order) {
    setPlaced({ id: o.id, status: o.status, total_paise: o.total_paise, updated_at: o.updated_at, paid_by: o.paid_by ?? null });
    setPlacedAt(o.created_at);
    setStep("placed");
  }
  const openOrderNow = orders.find((o) => !["delivered", "cancelled"].includes(o.status));
  const openLive = openOrderNow ? { label: statusLabel(openOrderNow.status), no: shortId(openOrderNow.id), onOpen: () => openOrder(openOrderNow) } : null;
  // "Forget me on this phone": what this phone remembers is wiped and the session ends.
  async function forgetMe() {
    try { await getClient().auth.signOut(); } catch { /* offline: the local wipe still runs */ }
    try { window.localStorage.clear(); } catch { /* blocked storage: nothing to wipe */ }
    window.location.reload();
  }

  const lines = useMemo(() => cartLines(cart, menu?.dishes ?? []), [cart, menu]);
  const kitchenName = area?.kind === "ok" ? area.kitchen.name : area?.kind === "closed" ? area.name : "";
  const offers = useOffers(OFFERS_ON && lock === "customer" && step === "bill", area?.kind === "ok" ? area.kitchen.id : null, pin, toOrderItems(cart));   // story #588
  const total = offers.quote ? offers.quote.to_pay_paise : cartTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  const [cancelling, setCancelling] = useState(false);
  // The customer cancels while the order is still placed (story B3). The database checks the rule; the live list brings the new status.
  async function cancelOrder() {
    if (!placed) return;
    setCancelling(true);
    setConfirmError(null);
    const { data, error: failed } = await getClient().rpc("cancel_order", { p_order: placed.id, p_reason: null });
    if (failed) setConfirmError("The kitchen has started, so this order cannot be cancelled now. Call the kitchen if you need to.");
    else if (data?.order) setOrders((cur) => mergeOrder(cur, data.order as Order));
    setCancelling(false);
  }

  // Story #551: a guest confirms a phone number before the order goes; the continuation runs once the sheets are closed (so it sees the new name and phone).
  useEffect(() => {
    if (!gate) return;
    let alive = true;
    ensureSession().then(() => getClient().auth.getUser()).then(({ data }) => {
      const p = data.user && !data.user.is_anonymous ? data.user.phone : null;
      const n = (data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name) as string | undefined;
      if (alive) setSignedIn(!!data.user && !data.user.is_anonymous);
      if (alive && p) { setVerified(true); setPhone(p.replace(/^91/, "")); if (n) setName((cur) => cur || n); }
    }).catch(() => { if (alive) setSignedIn(false); });
    return () => { alive = false; };
  }, [gate]);
  useEffect(() => {
    if (!pendingPlace || otpOpen || nameOpen) return;
    if (!name.trim() && !nameAsked) return void setNameOpen(true);
    setPendingPlace(false);
    void place();
  }, [pendingPlace, otpOpen, nameOpen, nameAsked, name]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function place() {
    if (lock && lock !== "customer") return;   // story H2: only the customer app and the demo console place orders
    if (gate && !verified) { setOtpOpen(true); return; }
    if (gate && !name.trim() && !nameAsked) { setPendingPlace(true); return; }
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
      const { order, confirm } = ordersV2 && areaKitchenId
        ? await placeOrderV2({ kitchenId: areaKitchenId, pin: pin ?? "", items, address: address.trim(), key: keyRef.current.key, expectedPaise: total, code: offers.code, none: offers.none }, v2Deps())
        : await placeOrder({ sessionId, key: keyRef.current.key, items, address: address.trim() }, api());
      setPlaced(order);
      capture("order_placed", { items_count: lines.length });
      setPlacedLines(lines.map((l) => ({ name: l.dish.name, qty: l.qty, paise: l.line_paise })));
      if (!demo) void savePlatform(getClient(), order.id, clientPlatform(navigator.userAgent));   // story H14: the iPhone share of orders
      setConfirmCfg(confirm);
      setPlacedAt(new Date().toISOString());
      setAsking(false);
      setSnoozeUntil(0);
      setConfirmError(null);
      notYetCount.current = 0;
      setStep("placed");
      setPayState(lock === "customer" && payMethod !== "cod" ? "ready" : null);
      setPayStart(new Date().toISOString());
      setPayError(null);
      setCart({});
      keyRef.current = null;
    } catch (e) {
      if (e instanceof PriceChanged) offers.replace(e.quote);   // the Bill shows the new To pay; nothing is ordered until the customer taps again
      pushTrail(`error: ${e instanceof Error ? e.message : "place failed"}`);
      setError(e instanceof PlaceError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const opsView = (
    <OpsScreen orders={orders} decisions={demo ? (orders.some((o) => ["ready", "out_for_delivery", "delivered"].includes(o.status)) ? demoDecisions() : []) : ops.decisions} lags={demo ? [800] : live.lags}
        stats={demo ? { runsToday: 6, lastDecideMs: 310 } : ops.stats} error={demo ? null : ops.error ?? live.error} failed={ops.failed} sample={demo} />
  );
  // The kitchen of the delivery in hand, for "Pick up at" (story H11). Read once per kitchen; nothing in the offline demo.
  const jobKitchenId = role === "rider" && !demo ? riderOrders(orders)[0]?.kitchen_id ?? orders[0]?.kitchen_id ?? null : null;   // #229: the hours set the cash day even with no job in hand
  const [jobKitchen, setJobKitchen] = useState<KitchenCard | null>(null);
  useEffect(() => {
    if (!jobKitchenId) return;
    let alive = true;
    fetchKitchen(getClient(), jobKitchenId).then((k) => { if (alive) setJobKitchen(k); }).catch(() => undefined);
    return () => { alive = false; };
  }, [jobKitchenId]);
  const riderScreen = (gate: RiderGateState | null) => (
    <RiderScreen orders={orders} loading={live.loading} error={live.error} busyId={busyId} arrived={arrived}
      onAct={(o, a) => act(o, a, "rider")} gate={gate} kitchen={jobKitchen} />
  );
  const riderView = lock === "rider" ? <RiderGate>{riderScreen}</RiderGate> : riderScreen(null);
  // Story #229: the kitchen confirms a rider's cash. The rows are stamped here too, so the screen does not wait for the next read.
  async function handover(riderId: string): Promise<string | null> {
    const failed = await confirmHandover(getClient(), riderId);
    if (!failed) setOrders((cur) => cur.map((o) => o.rider_id === riderId && o.status === "delivered" && isCash(o) && !o.cash_handed_at ? { ...o, cash_handed_at: new Date().toISOString() } : o));
    return failed;
  }
  const kitchenScreen = (gate: KitchenGateState | null) => (
    <KitchenScreen orders={orders} loading={live.loading} error={live.error} busyId={busyId}
      onStep={(o, to) => act(o, { kind: "status", to }, "kitchen")} onHandover={handover} gate={gate} />
  );
  const kitchenView = lock === "kitchen" ? <KitchenGate>{kitchenScreen}</KitchenGate> : kitchenScreen(null);
  const needArea = lock === "customer" && step !== "placed" && step !== "orders" && !(pin && (area?.kind === "ok" || area?.kind === "closed"));
  // Story #667: with the phone code on, the first screen is the number and the code (or Google); nothing else shows before it.
  const customerView = gate && signedIn === null ? <div className="ui-pad"><Skeleton lines={3} /></div> : gate && signedIn === false ? (
    <OtpSheet welcome phone={phone} onClose={() => undefined}
      onVerified={(p) => { setPhone(p); setVerified(true); setSignedIn(true); }} />
  ) : needArea ? (
    <AreaScreen pin={pin} address={address} area={area} busy={looking} error={areaError} onPlace={(pl) => { setAddress(pl.address); choosePin(pl.pin, pl.from); }} />
  ) : (
    <>
        {step === "menu" && (
          <MenuScreen land={land.current} onLanded={() => { land.current = false; }} dishes={menu?.dishes ?? null} fromCache={menu?.fromCache ?? false} error={menuError} onRetry={() => setMenuTry((n) => n + 1)}
            pin={pin} name={name} qty={cart} cartCount={count} cartTotal={total}
            kitchenName={kitchenName}
            openText={shown?.kind === "ok" ? openTill(shown.kitchen.closes_at) : ""}
            closedText={shown?.kind === "closed" ? closedLine(shown.opens_at, shown.paused === true) : null}
            onAdd={(id) => setCart((c) => addDish(c, id))} onChange={(id, d) => setCart((c) => changeQty(c, id, d))} onOpenCart={() => { setError(null); setStep("bill"); }}
            onChangePin={changeArea} onOrders={() => setStep("orders")} onYou={() => setStep("account")} />
        )}
        {step === "orders" && <OrdersScreen orders={orders} loading={live.loading} kitchenName={kitchenName} onOpen={openOrder} onMenu={() => setStep("menu")} onYou={() => setStep("account")} />}
        {step === "account" && (
          <AccountScreen onGivenName={(n) => setName((v) => v || n)} name={name} phone={phone} address={address} pin={pin} onName={setName} onPhone={setPhone} onAddress={setAddress}
            alerts={reminder} onAlerts={toggleAlerts} alertsError={alertsError} live={openLive} onForget={forgetMe}
            onMenu={() => setStep("menu")} onOrders={() => setStep("orders")} />
        )}
        {menu && step === "bill" && (
          <BillScreen lines={lines} total={total} offers={offers.quote ? { quote: offers.quote, codeError: offers.codeError, onApply: offers.apply, onRemove: offers.remove } : undefined} kitchenName={kitchenName} pin={pin} address={address} onAddress={setAddress}
            details={lock === "customer" ? { name, phone, onName: setName, onPhone: setPhone, gate } : undefined}
            pay={lock === "customer" ? { value: payMethod, onChange: setPayMethod } : undefined} sending={sending} error={error}
            onBack={() => setStep("menu")} onPlace={place} />
        )}
        {step === "placed" && placed && (
          <PlacedScreen order={placed} status={tracked?.status ?? placed.status} paidBy={tracked?.paid_by ?? null}
            placedAt={tracked?.created_at ?? placedAt} kitchenName={kitchenName} pin={pin} kitchenPhone={area?.kind === "ok" ? area.kitchen.phone ?? null : null}
            lines={tracked && "items" in tracked ? tracked.items.map((i) => ({ name: i.name, qty: i.qty, paise: i.price_paise * i.qty })) : placedLines}
            address={tracked && "address" in tracked ? tracked.address : address.trim()}
            confirmedAt={tracked && tracked.status === "delivered" ? tracked.updated_at : null}
            asking={asking} busy={confirming} error={confirmError} reminder={reminder}
            onYes={yes} onNotYet={notYetTap} onAllowReminder={allowReminder} pay={paidNow || payState || resumedOnline ? { state: paidNow ? "paid" : payState ?? "waiting", method: payMethod === "cod" ? "upi" : payMethod, startedAt: payState ? payStart : null, error: payError, onPay: payNow, onCash: payCash, onSimulate: () => void simulatePaid(import.meta.env.VITE_PAYMENTS_DEV_SECRET ?? "", payRef.current) } : undefined}
            onBack={() => setStep("menu")} onMenu={() => { setPlaced(null); setCart({}); setStep("menu"); }} onCancel={cancelOrder} cancelling={cancelling} rider={rider} onCall={() => void tapCall(getClient(), placed.id)} />
        )}
    </>
  );

  const framed = (lock === "customer" && role === "customer") || (lock === "rider" && role === "rider") || (lock === "kitchen" && role === "kitchen") || (lock === "admin" && role === "admin");   // the Ink boards fill the phone; the chrome goes below
  const Shell = framed ? "div" : "main";
  return (
    <>
    {framed && <main className="frame">{role === "rider" ? riderView : role === "kitchen" ? kitchenView : role === "admin" ? <AdminScreen /> : customerView}</main>}
    <Shell className={framed ? "shell below" : role === "split" ? "shell split" : "shell"}>
      {!demo && !framed && <SignIn mode={lock && lock !== "customer" ? "signin" : "link"} />}   {/* story #224: a customer never signs in; the staff gates carry their own Google button */}
      {!lock && <nav className="roles" aria-label="Screen">
        {(["customer", "kitchen", "rider", "split", "ops"] as const).map((r) => (
          <button key={r} type="button" className={role === r ? "btn" : "btn ghost"} aria-pressed={role === r} onClick={() => { pushTrail(`open ${r} tab`); setRole(r); }}>
            {r === "customer" ? "Customer" : r === "kitchen" ? "Kitchen" : r === "rider" ? "Rider" : r === "split" ? "Split" : "Ops"}
          </button>
        ))}
      </nav>}
      {otpOpen && <OtpSheet phone={phone} onClose={() => setOtpOpen(false)}
        onVerified={(p) => { setPhone(p); setVerified(true); setOtpOpen(false); setToast("Number confirmed"); setTimeout(() => setToast(null), 2500); setPendingPlace(true); }} />}
      {nameOpen && <NameSheet onDone={(n) => { if (n) setName(n); setNameAsked(true); setNameOpen(false); }} />}
      {toast && <p role="status" className="otp-toast">{toast}</p>}
      {demo && <p role="status" className="notice"><strong>Offline demo</strong></p>}
      {!lock && <DemoBar onReset={reset} getLink={shareLink} autoOn={auto || demo} autoNote={autoNote} onAuto={toggleAuto} />}
      {role === "kitchen" && !framed && kitchenView}
      {role === "rider" && !framed && riderView}
      {role === "ops" && (lock === "ops" ? <AdminGate>{opsView}</AdminGate> : opsView)}
      {role === "customer" && !framed && customerView}
      {role === "admin" && !framed && <AdminScreen />}
      <FeedbackSheet role={lock ?? "console"} button={!lock} screen={`${window.location.pathname}${lock ? "" : ` (${role} tab)`}`}
        order={placed ? { id: placed.id, status: orders.find((o) => o.id === placed.id)?.status ?? placed.status } : orders[0] ? { id: orders[0].id, status: orders[0].status } : null}
        getSession={currentSession} send={async (r) => { const id = await sendFeedback(r, api()); capture("feedback_sent"); return id; }} preset={preset} />
      {role === "split" && (
        <div className="panes">
          <div>{customerView}</div>
          <div>{kitchenView}</div>
        </div>
      )}
    </Shell>
    </>
  );
}
