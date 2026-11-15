// The customer flow in one place: menu, cart, bill, placed (story #48). No router yet: four steps in state.
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDoorMethods, type DoorMethod } from "./lib/doorMethods";
import { onBackScreen, screenStep } from "./lib/back";
import { readRiderQr } from "./lib/payMethods";
import { addDish, BILL_CLEARED_LINE, cartLines, KITCHEN_CHANGED_BILL, cartTotal, changeQty, kitchenChangedLine, moveCart, notMadeLine, reorderCart, toOrderItems, type Cart, type Held, type Line } from "./lib/cart";
import { mergeOrder, riderOrders, cancelKind, shortId, statusLabel, type Order, type RiderAction, confirmHandover, deliveredAt, earlyMin, isCash } from "./lib/kitchen";
import { clientPlatform } from "./lib/platform";
import { riderRefused, savePlatform, tapCall } from "./lib/signals";
import { useLiveOrders } from "./lib/useLiveOrders";
import { loadMenu, MENU_KEY, type Dish } from "./lib/menu";
import { chooseKitchen, fetchKitchens, loadArea, closedCopy, clearedLine, openingText, resolveArea, shownArea, type Area } from "./lib/area";
import { clearPlace, HERE, herePlace, isHere, loadPlace, pointOf, savePlace, type StoredPlace } from "./lib/place";
import { AreaScreen } from "./screens/AreaScreen";
import { AlertsAsk } from "./screens/AlertsAsk";
import { LocationOffSheet } from "./screens/LocationOffSheet";
import { NoKitchen } from "./screens/NoKitchen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { AdminGate } from "./screens/AdminGate";
import { RiderGate } from "./screens/RiderGate";
import { readRates, type Rates } from "./lib/incentive";
import { readPastDays } from "./lib/pastDays";
import { fetchKitchen, fetchOnlyKitchen, riderChangePaid, type KitchenCard, type RiderGateState } from "./lib/rider";
import { KitchenGate, type KitchenGateState } from "./screens/KitchenGate";
import { enablePush, watchSession } from "./lib/push";
import { takeReturn } from "./lib/auth";
import { alertsState, readOff, turnAlertsOff, writeOff, type Alerts } from "./lib/alerts";
import { isPhone, loadProfile, markPlace, placeMark, saveProfile } from "./lib/profile";
import { capture } from "./lib/analytics";
import { actDeps, addEvent, changeStatus, confirmDelivery, declineOrder, orderDeps, PlaceError, sendFeedback, type PlacedOrder } from "./lib/orders";
import { confirmAt, DEFAULT_CFG, mayAsk, notYet, reaskMs, type ConfirmCfg } from "./lib/confirm";
import { fetchOrders } from "./lib/live";
import { pushTrail } from "./lib/trail";
import { trace } from "./lib/trace";
import { cancelLine, NO_INTERNET } from "./lib/errorLines";
import { FeedbackSheet } from "./screens/FeedbackSheet";
import { ensureSession, fetchMenuRows, fetchRiderCard, getClient, type RiderCard } from "./lib/supabase";
import { openTill } from "./lib/browse";
import { AccountScreen } from "./screens/AccountScreen";
import { DeliverToScreen } from "./screens/DeliverToScreen";
import { placeSearch } from "./lib/placeSearch";
import { PinMapScreen, type Saved } from "./screens/PinMapScreen";
import { keepRecent, listRecents, recentAt, recentWords, RECENTS_MAX, touchRecent, type Recent, type Searched } from "./lib/recents";
import { distanceM, FAR_M, addAddress, editAddress, hasPoint, listAddresses, lastUsed, nearM, nearSaved, removeAddress, touchAddress, type SavedAddress } from "./lib/addresses";
import { findPhone, nearestPin, type LocWhy, type Place } from "./lib/locate";
import { currentSession, scopeFor } from "./lib/session";
import { MenuScreen } from "./screens/MenuScreen";
import { BillScreen, CONFIRM_PLACE_LINE } from "./screens/BillScreen";
import { OFFERS_ON } from "./lib/quote";
import { watchMenu } from "./lib/liveMenu";
import { placeOrderV2, PriceChanged, v2Deps } from "./lib/ordersV2";
import { useOffers } from "./lib/useOffers";
import { openOrderToResume } from "./lib/resume";
import { SignIn } from "./screens/SignIn";
import { OtpSheet } from "./screens/OtpSheet";
import { Skeleton } from "./ui";
import { otpLoginOn, rememberOtpSetting } from "./lib/otpGate";
import { watchOtpSwitch } from "./lib/otpSwitch";
import { createPayment, switchToCash, simulatePaid, type PayMethod } from "./lib/payments";
import { openGateway } from "./lib/payGateway";
import { registerNative, wrapperToken } from "./lib/pushNative";
import { AdminScreen } from "./screens/AdminScreen";
import { loadDraft, saveDraft } from "./lib/draft";
import { PlacedScreen, type Track } from "./screens/PlacedScreen";
import { readRider, watchRider, type Tracked } from "./lib/riderTrack";
import { readEta, type Eta } from "./lib/eta";
import { readArriving, readStepTimes, riderArrivingAt, riderAtDoor, watchArriving, type StepTimes } from "./lib/arriving";
import type { Point } from "./lib/riderMap";
import { KitchenScreen } from "./screens/KitchenScreen";
import { RiderScreen } from "./screens/RiderScreen";
import { useOps } from "./lib/useOps";
import { OpsScreen } from "./screens/OpsScreen";
import { DemoBar } from "./screens/DemoBar";
import { AUTOPILOT_MS, demoDecisions, demoOrder, nextAutoAction } from "./lib/autopilot";

type Step = "menu" | "bill" | "placed" | "orders" | "account" | "deliver";
type Role = "customer" | "kitchen" | "rider" | "split" | "ops" | "admin";

const api = orderDeps;

// `lock` makes this one of the role apps (story #83): that role only, no role tabs, no demo tools. Without it, this is the demo console.
export function App({ lock }: { lock?: Exclude<Role, "split"> } = {}) {
  const [menu, setMenu] = useState<{ dishes: Dish[]; fromCache: boolean; slow?: boolean; kitchen?: string } | null>(null);   // kitchen (story 1540): whose menu this is, in the customer app
  // The customer app asks for a pin code and shows the menu of the kitchen that serves it (story B2). The demo console and the other apps keep the plain menu.
  // Story 1532: the one delivery place (point, words, postal code, house, confirmed mark), kept in the phone as one thing (lib/place.ts). The postal code, the words and the point are read from it.
  const [where, setPlaceNow] = useState<StoredPlace | null>(loadPlace);
  const whereNow = useRef(where);   // the latest place, for code that runs after a wait (the find on open, a delete after its Undo)
  whereNow.current = where;
  const setPlace = (next: StoredPlace | null) => { whereNow.current = next; setPlaceNow(next); if (next) savePlace(next); else clearPlace(); };
  const pin = lock === "customer" ? where?.pin ?? null : null;
  const address = where?.address ?? "";
  const selectedId = where?.id ?? null;
  const lat = where?.lat ?? null;
  const lng = where?.lng ?? null;
  const from = useMemo(() => (lat !== null && lng !== null ? { lat, lng } : null), [lat, lng]);   // where the food goes, confirmed or not: it picks the nearest kitchen
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
  const [menuTry, setMenuTry] = useState(0);   // story #637: Try again and the phone coming back online read the menu again
  useEffect(() => {
    const again = () => setMenuTry((n) => n + 1);
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, []);
  // The customer app keeps an unfinished order across a refresh (story B1); the demo console and the other apps start fresh.
  const [draft0] = useState(() => (lock === "customer" ? loadDraft() : null));
  const [step, setStep] = useState<Step>(lock === "customer" && takeReturn() ? "account" : draft0 && draft0.step !== "placed" && draft0.step !== "orders" ? draft0.step === "cart" ? "bill" : (draft0.step as Step) : "menu");   // an older draft may hold the cart step: the bill replaced it (H10c)
  // Story 1396, 1415: every screen but the menu (the bill, the tracker, orders, You, Deliver to) adds a Back step, so the phone's Back shows the screen under them; on the menu Back leaves the app (lib/back.ts).
  const stepNow = useRef(step);
  stepNow.current = step;
  const fromBack = useRef<Step | null>(null);
  const lastStep = useRef(step);
  useEffect(() => {
    if (lock !== "customer") return;
    onBackScreen((sc) => { if (sc === stepNow.current) return; fromBack.current = sc as Step; setStep(sc as Step); });
  }, []);
  useEffect(() => {
    if (lock !== "customer") return;
    const stepped = step !== "menu";
    const was = lastStep.current;
    lastStep.current = step;
    if (fromBack.current === step) { fromBack.current = null; return; }
    screenStep(step, stepped, was === "bill" && step === "placed");   // a placed order: Back from the tracker shows the menu, never the bill again
  }, [step]);
  const [cart, setCart] = useState<Cart>(draft0?.cart ?? {});
  const [note, setNote] = useState("");   // story #935: the note for the kitchen is for this order only, never kept
  const [name, setName] = useState(draft0?.name ?? "");
  const [phone, setPhone] = useState(draft0?.phone ?? "");
  const [savedPhone, setSavedPhone] = useState<string | null>(null);   // story 1417 (board BF2): the phone kept on the account; the bill shows it on one line
  const [signInName, setSignInName] = useState("");   // story 1417: the Bill never asks the name; the order takes this one when none is saved
  // Story #551: the phone code at checkout. verified = this user already has a phone linked.
  // Story 829: the phone code is a switch the admin flips (settings row otp_login_on), off until an SMS provider is live. The login wall (Google, or the code) shows to
  // a signed-out customer either way. otpSetting: undefined = not read yet, null = could not be read (then VITE_OTP_GATE, then off).
  const [otpSetting, setOtpSetting] = useState<boolean | null | undefined>(undefined);
  useEffect(() => {
    if (lock !== "customer") return;
    const giveUp = setTimeout(() => setOtpSetting((cur) => (cur === undefined ? null : cur)), 4000);   // a slow network never holds the first screen
    const stop = watchOtpSwitch(getClient(), (v) => { if (typeof v === "boolean") rememberOtpSetting(v); setOtpSetting(v); });   // story #1106: the last read is kept for offline
    return () => { clearTimeout(giveUp); stop(); };
  }, [lock]);
  const wall = lock === "customer";   // the customer app's front door: a signed-out customer meets Google (or the phone code) before the menu
  const gate = lock === "customer" && otpSetting !== undefined && otpLoginOn(otpSetting, import.meta.env, window.localStorage);
  const [verified, setVerified] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);   // story #667: null = not asked yet; the first screen waits so a returning customer never sees it flash
  const [email, setEmail] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);   // story #975: the Google photo in the profile circle; none for a phone or guest account
  const [toast, setToast] = useState<string | null>(null);
  // Story #552: how you pay. cod = today's cash order. UPI or Card: the order is placed, then Pay now makes the payment (the state machine lives here).
  const [payMethod, setPayMethod] = useState<PayMethod>("cod");
  // Story #1261 (board P6): the ways to pay at the door that Admin has on, read when the bill opens. The pick is only what the screen shows; the rider records how it was paid.
  const [doorMethods, setDoorMethods] = useState<DoorMethod[] | null>(null);   // null: the read has not answered yet
  const [doorPick, setDoorPick] = useState<DoorMethod | null>(null);
  const doorValue: DoorMethod | null = doorMethods && doorPick && doorMethods.includes(doorPick) ? doorPick : doorMethods?.[0] ?? null;
  useEffect(() => { if (step === "bill" && lock === "customer") void fetchDoorMethods(getClient()).then(setDoorMethods); }, [step, lock]);
  const [payState, setPayState] = useState<"ready" | "starting" | "waiting" | "failed" | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payStart, setPayStart] = useState<string | null>(null);
  const payRef = useRef("");
  useEffect(() => {
    if (lock === "customer") saveDraft({ step: step === "account" || step === "deliver" ? "menu" : step, cart, address, name, phone });
  }, [lock, step, cart, address, name, phone]);
  // Saved details come back on the next visit (story B3); what the customer already typed this time is kept.
  useEffect(() => {
    if (lock !== "customer") return;
    ensureSession().then(() => loadProfile(getClient())).then((p) => {
      if (!p) return;
      setName((v) => p.name || v);   // story 1417: a name saved on You wins over the sign-in name
      setPhone((v) => v || p.phone);
      if (isPhone(p.phone)) setSavedPhone(p.phone);
    }).catch(() => {});
  }, [lock]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [role, setRole] = useState<Role>(lock ?? "customer");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [arrived, setArrived] = useState<Map<string, string>>(new Map());   // story 1182: order id to when Arriving was sent
  // The live list runs for the kitchen, the rider, and the customer while the tracker is on screen.
  // Autopilot (story #53): 'demo' is the offline story played from local data; 'auto' is the autopilot moving a real order.
  const [auto, setAuto] = useState(false);
  const [demo, setDemo] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);   // only the customer app (not the demo console) looks once, at load, for an order that is still open
  const live = useLiveOrders(!demo && (auto || role === "kitchen" || role === "rider" || role === "split" || role === "ops" || (role === "customer" && (step === "placed" || step === "orders" || (lock === "customer" && !resumed)))), lock === "kitchen" || lock === "rider" ? lock : undefined);
  const { orders, setOrders } = live;
  const sawLoading = useRef(false);
  useEffect(() => {
    if (resumed || lock !== "customer" || demo) return;
    if (live.loading) return void (sawLoading.current = true);
    if (!sawLoading.current) return;   // the first render comes before the load starts
    setResumed(true);
    const open = openOrderToResume(orders);
    if (open && step === "menu" && !placed) {
      setPlaced({ id: open.id, status: open.status, total_paise: open.total_paise, updated_at: open.updated_at, paid_by: open.paid_by ?? null, bill: open.bill ?? null });
      setPlacedAt(open.created_at);
      setStep("placed");
    }
  }, [live.loading, orders, resumed, lock, demo, step, placed]);
  const ops = useOps(!demo && role === "ops", orders);   // the offline story never asks the server
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
    else if (trackedSeen.current && lock !== "customer") {   // story #1014: only the demo console leaves a vanished order; a customer leaves the placed screen by their own tap
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
    let ok = false;
    setAlertsError(null);
    writeOff(window.localStorage, false);
    const native = await wrapperToken(window);   // story #554: a phone wrapper also registers its device token, with its platform
    if (native && !(await registerNative(native))) return void setAlertsError(ALERTS_FAILED);
    await pushWith(() => Notification.requestPermission()).then((r) => {
      track("push_subscribe", r, typeof Notification === "undefined" ? "no_notification_api" : Notification.permission);
      if (r === "denied") return setReminder("none");
      if (r === "unsupported") return void Notification.requestPermission().then((p) => setReminder(p === "granted" ? "on" : "none"), () => setReminder("none"));
      if (r === "not_set_up") return void Notification.requestPermission().then((p) => (p === "granted" ? setAlertsError(ALERTS_FAILED) : setReminder("none")), () => setReminder("none"));   // story #661: permission given but the set-up did not work: say so, the switch stays off
      if (r === "failed") return setAlertsError(ALERTS_FAILED);
      ok = true;
      setReminder("on");
    });
    return ok;
  }
  // Story #1049 part 2 (board N0): first open, after the number and before the location, alerts are asked once. Turn on asks the phone's permission and moves on either way; Not now moves on.
  const ASKED_KEY = "gs_alerts_asked";
  const [alertsAsked, setAlertsAsked] = useState(() => { try { return window.localStorage.getItem(ASKED_KEY) === "1"; } catch { return false; } });
  const [askingAlerts, setAskingAlerts] = useState(false);
  const markAsked = () => { try { window.localStorage.setItem(ASKED_KEY, "1"); } catch { /* asked again next visit */ } setAlertsAsked(true); };
  // Story #1116: moves on either way. A permission call that never settles (iPhone Safari outside the home-screen app) must not hold the screen: after 8 s it goes on.
  const ALERTS_WAIT_MS = 8000;
  async function turnOnFirst() {
    setAskingAlerts(true);
    try { await Promise.race([allowReminder(), new Promise((go) => setTimeout(go, ALERTS_WAIT_MS))]); } finally { setAskingAlerts(false); markAsked(); }
  }
  // Story #1049 part 3 (board NK-A): no kitchen serves this pin. One stored ask per person and pin (area_request_add_v2); nothing is sent from here.
  const [areaAsk, setAreaAsk] = useState<"idle" | "busy" | "done">("idle");
  const [areaAskError, setAreaAskError] = useState<string | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);   // story 1133: Search for my address opens the search with the cursor in it. Story 1530: with the pin map open it is the one search, shown in place of the map until a pick or Back
  const [farPick, setFarPick] = useState<null | { at: Place; pin: string; address: string }>(null);   // story #1128 (board C6b): Confirm on a pin no kitchen reaches; NK-A shows for it, C7 never opens
  const [areaOffer, setAreaOffer] = useState<number | null>(null);   // story #1129: the promise the stored row holds; the letter shows it only when the server said so
  // One ask: the stored row for this account and pin (area_request_add_v2). Answers an error in words, or null. The Rs 100 promise comes back in the answer and the letter shows it only then.
  async function askArea(askPin: string, at: { lat: number; lng: number } | null): Promise<string | null> {
    const { data, error } = await getClient().rpc("area_request_add_v2", { p_pin: askPin, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null });
    const ans = data as { ok?: boolean; message?: string; offer_paise?: number } | null;
    if (!error && ans?.ok) { setAreaOffer(ans.offer_paise && ans.offer_paise > 0 ? ans.offer_paise : null); return null; }
    return ans?.message ?? "Could not set that up. Try again.";
  }
  async function tellMeWhenWeCome() {
    if (!pin) return;
    setAreaAsk("busy");
    setAreaAskError(null);
    const err = await askArea(pin, from);
    if (!err) return setAreaAsk("done");
    setAreaAsk("idle");
    setAreaAskError(err);
  }
  useEffect(() => { setAreaAsk("idle"); setAreaAskError(null); }, [pin]);
  // Story #718 (board L1): a closed kitchen offers one push when it opens. Alerts are allowed first when they are not on yet.
  const [tellMe, setTellMe] = useState<"idle" | "busy" | "done">("idle");
  const [tellMeError, setTellMeError] = useState<string | null>(null);
  async function tellMeWhenOpen() {
    const kitchenId = shown?.kind === "closed" ? shown.id : (menu?.dishes.length === 0 && areaKitchenId) || null;   // closed kitchen (#718), or an open one with no dishes yet (#891, board M7)
    if (!kitchenId) return;
    setTellMe("busy");
    setTellMeError(null);
    const allowed = reminder === "on" || (await allowReminder());
    const { data, error } = allowed ? await getClient().rpc("open_alert_add_v2", { p_kitchen: kitchenId }) : { data: null, error: null };
    const ans = data as { ok?: boolean; message?: string } | null;
    if (allowed && !error && ans?.ok) return setTellMe("done");
    setTellMe("idle");
    setTellMeError(ans?.message ?? (allowed ? "Could not set that up. Try again." : "Allow alerts first."));
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
      const answer = await confirmDelivery({ orderId: placed.id }, actDeps());
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
    if (lock && lock !== "customer") return;   // story H2: the kitchen, rider, ops and admin apps have nothing to sell
    if (!lock) return void loadMenu(() => fetchMenuRows(), window.localStorage, MENU_KEY, { onLater: setMenu }).then((m) => { setMenu(m); setMenuError(null); }, (e: Error) => setMenuError(e.message));
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
  useEffect(() => { if (menu?.fromCache) capture("error_shown", { line_key: menu.slow ? "menu_slow" : "menu_offline" }); }, [menu?.fromCache, menu?.slow]);   // story #930: how often the banner shows
  const areaKitchenId = area?.kind === "ok" ? area.kitchen.id : area?.kind === "closed" ? area.id : null;
  useEffect(() => {
    if (lock !== "customer" || !areaKitchenId) return;
    let alive = true;
    loadMenu(() => fetchMenuRows(areaKitchenId), window.localStorage, `${MENU_KEY}.${areaKitchenId}`, { onLater: (m) => { if (alive) setMenu({ ...m, kitchen: areaKitchenId }); } })   // story 930: a second read lands, or fails, after the first
      .then((loaded) => { if (alive) { setMenu({ ...loaded, kitchen: areaKitchenId }); setMenuError(null); } }, (e: Error) => { if (alive) setMenuError(e.message); });
    return () => { alive = false; };
  }, [lock, areaKitchenId, menuTry]);
  // Story #619: the kitchen's switch, its hours and its dishes follow live. Any change reads the kitchen and the menu again, quietly (no loading screen).
  const [liveTick, setLiveTick] = useState(0);
  useEffect(() => {
    if (lock !== "customer" || !areaKitchenId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchMenu(getClient(), areaKitchenId, () => { clearTimeout(timer); timer = setTimeout(() => setLiveTick((n) => n + 1), 300); });   // one change often writes two rows
    return () => { clearTimeout(timer); stop(); };
  }, [lock, areaKitchenId]);
  useEffect(() => {
    if (liveTick === 0 || lock !== "customer" || !pin || !areaKitchenId) return;
    let alive = true;
    resolveArea(pin, () => fetchKitchens(getClient()), window.localStorage, from ?? undefined).then((found) => { if (alive) setArea(found); }, () => undefined);
    loadMenu(() => fetchMenuRows(areaKitchenId), window.localStorage, `${MENU_KEY}.${areaKitchenId}`, { onLater: (m) => { if (alive) setMenu({ ...m, kitchen: areaKitchenId }); } }).then((loaded) => { if (alive) { setMenu({ ...loaded, kitchen: areaKitchenId }); setMenuError(null); } }, () => undefined);
    return () => { alive = false; };
  }, [liveTick]);   // eslint-disable-line react-hooks/exhaustive-deps
  function choosePlace(next: StoredPlace) {   // a new postal code finds the kitchen again; the same one only moves the point
    if (lock === "customer" && next.pin !== whereNow.current?.pin) {
      capture("address_set", { from: next.lat !== null ? "location" : "typed" });
      setArea(null);
      setMenu(null);
      setMenuError(null);
      ensureSession().then((uid) => getClient().from("customers").upsert({ user_id: uid, pin_code: next.pin, updated_at: new Date().toISOString() }, { onConflict: "user_id" })).catch(() => {});
    }
    setPlace(next);
  }
  // Story #976, changed by 1529: the saved addresses. On open the place follows the phone: the saved address it is at, else "Where you are now"; not found, the place stays and the sheet asks.
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [addrTried, setAddrTried] = useState(false);   // story #1112: the open is over (the addresses answered or failed, the phone was looked for): until then a signed-in phone with no pin is loading, not new
  const [here, setHere] = useState<Place | null>(null);
  const [why, setWhy] = useState<LocWhy | null>(null);   // bug 1526: why the phone was not found; null when it was found or not looked for yet
  const [finding, setFinding] = useState(false);   // a tap's find is running: the tapped button says so
  const [sheet, setSheet] = useState(false);   // story #1056, board LO-V1: the sheet "Where to bring your food?", once per app open
  const [known, setKnown] = useState(false);   // story 1529: this customer has confirmed a place once (the mark on the server, a saved address, or a place on this phone): never the first-open screen again
  const marked = useRef(false);
  const savedNow = useRef(saved); savedNow.current = saved;
  const [recents, setRecents] = useState<Recent[]>([]);   // story 1530: "Recently searched", the customer's own rows
  const recentsNow = useRef(recents); recentsNow.current = recents;
  const hereNow = useRef(here); hereNow.current = here;
  const whyNow = useRef(why); whyNow.current = why;
  const cartNow = useRef(cart); cartNow.current = cart;
  // Story #1162 (owner, 9 Nov): the kitchen closes (live, or by the clock) under a customer who has items but has NOT placed the order: the app goes to the closed menu, the bill is cleared, and a line says so.
  // A placed order is never moved (the step is "placed" or "orders"), and an order being sent is let finish first.
  const [closedNote, setClosedNote] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const [pinMap, setPinMap] = useState<null | { center: Place; edit?: SavedAddress; follow?: boolean; recent?: Searched }>(null);   // recent (story 1530): the map was opened from search, so Confirm makes a recent, not a saved address   // story 1037: the one full-screen map, the door for Add new address, Use current location and a tapped search result
  const [settingUp, setSettingUp] = useState(false);   // story 1384 (board A1e): the first Save address; the location slip waits with the rider until the kitchen is found
  useEffect(() => { if (areaError || area?.kind === "none") setSettingUp(false); }, [areaError, area]);   // a failed read or no kitchen here ends it, so a later change of place never shows it again
  useEffect(() => {
    if (lock !== "customer" || !shown) return;
    const open = shown.kind === "ok";
    const justClosed = shown.kind === "closed" && wasOpen.current;
    wasOpen.current = open;
    if (!justClosed || sending) return;
    const items = Object.values(cart).some((q) => q > 0);
    if (!items || !(step === "menu" || step === "bill" || step === "deliver" || pinMap)) return;
    setCart({}); setNote(""); setPinMap(null); setFocusSearch(false); setStep("menu");
    setClosedNote(clearedLine(shown.opens_at, shown.paused === true));
  }, [shown?.kind]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!closedNote) return;
    const off = () => { if (document.querySelector(".ui-closed-note")) setClosedNote(null); };   // story 1540: only a tap while the line is on screen (the menu) uses it up; a line set on Deliver to waits for the menu
    window.addEventListener("pointerdown", off, { capture: true });
    return () => window.removeEventListener("pointerdown", off, { capture: true });
  }, [closedNote]);
  const mapStart = (): Place => {   // where the map opens when nothing says otherwise: the phone, else the picked address, else the kitchen whose menu shows (story 1502), else the city centre
    const row = (saved ?? []).find((r) => r.id === selectedId);
    const k = area?.kind === "ok" ? area.kitchen : null;
    return here ?? (row && row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : k && typeof k.lat === "number" && typeof k.lng === "number" ? { lat: k.lat, lng: k.lng } : { lat: 28.6139, lng: 77.209 });
  };
  const openAtStart = (edit?: SavedAddress) => setPinMap({ center: mapStart(), edit, follow: true });   // story 1502: an open the person did not aim follows the phone's place once
  const confirmOnMap = () => {   // story 1532: the Bill's "Confirm on the map". An old saved row with no pin gets its pin; any other place opens the map at its point
    const row = (saved ?? []).find((r) => r.id === selectedId);
    if (row) openAtStart(row); else if (from) setPinMap({ center: from }); else openAtStart();
  };
  const opened = useRef(false);
  const held = () => stepNow.current === "bill" || stepNow.current === "placed" || stepNow.current === "orders";   // story #1014: a customer on the Bill or the tracker is never pulled
  function useSaved(a: SavedAddress, touch: boolean) {   // story 1532: a saved address with its pin is a confirmed place; an old row with no pin must be confirmed on the map
    choosePlace({ address: a.address, pin: a.pin, lat: a.lat, lng: a.lng, house: a.house ?? "", landmark: a.landmark ?? "", confirmed: a.lat !== null && a.lng !== null, id: a.id });
    if (touch) {
      const at = new Date().toISOString();
      setSaved((cur) => (cur ?? []).map((r) => (r.id === a.id ? { ...r, last_used_at: at } : r)));
      void touchAddress(getClient(), a.id);
    }
  }
  const pickRow = (a: SavedAddress) => { if (!hasPoint(a)) return openAtStart(a); useSaved(a, true); setSheet(false); setStep("menu"); };   // a row with no pin cannot be picked: the tap sets its pin
  function markOnce() {   // story 1529: the mark on the server, set once
    setKnown(true);
    if (marked.current) return;
    marked.current = true;
    ensureSession().then((uid) => markPlace(getClient(), uid)).catch(() => {});
  }
  // Stories 1529 and 1526: look for the phone. By itself the app uses only a permission given before; a tap asks. Not found: the cause is kept, for the true line.
  async function find(tap: boolean): Promise<Place | null> {
    if (tap) setFinding(true);
    const r = await findPhone(tap, whyNow.current);
    if (tap) setFinding(false);
    if (typeof r === "string") { setHere(null); setWhy(r); return null; }
    setHere(r); setWhy(null); setSheet(false);
    return r;
  }
  // Story 1529: the place follows the phone. Inside the near distance of a saved address: that address. Away from all: "Where you are now", with the postal code from our own
  // table (no Ola call), not confirmed and not saved, so the order waits for the map. A cart in progress never moves to another kitchen by itself; the far strip offers it.
  async function follow(at: Place) {
    if (held()) return;
    const c = getClient();
    const near = await nearM(c), was = whereNow.current;
    const row = nearSaved(savedNow.current ?? [], at, near);
    // Story 1530: no saved address here, but the phone is at the confirmed place this phone holds (its save failed, or it is a recent): that place stays, never "Where you are now".
    if (!row && was && was.confirmed && !was.id && was.lat !== null && was.lng !== null && distanceM(at, { lat: was.lat, lng: was.lng }) <= near) return;
    const pin = row ? row.pin : await nearestPin(at, undefined);
    if (!pin) return;   // no postal code for this point (no network, the sea): the place stays
    const next: StoredPlace = row ? { address: row.address, pin, lat: row.lat, lng: row.lng, house: row.house ?? "", landmark: row.landmark ?? "", confirmed: true, id: row.id } : herePlace(at, pin);
    const cur = whereNow.current;
    if (cur && row && cur.id === row.id) return;
    if (cur && !(await cartFits(cur, next))) return;
    if (!held()) choosePlace(next);
  }
  // A cart belongs to one kitchen. True when there is no cart, or both places are served by the same kitchen. A lookup that fails is "no".
  async function cartFits(cur: StoredPlace, next: StoredPlace): Promise<boolean> {
    if (!Object.values(cartNow.current).some((q) => q > 0)) return true;
    const all = await fetchKitchens(getClient()).catch(() => null);
    const kitchenOf = (p: StoredPlace) => { const a = chooseKitchen(all ?? [], p.pin, p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : undefined); return a.kind === "ok" ? a.kitchen.id : a.kind === "closed" ? a.id : null; };
    return !!all && kitchenOf(cur) === kitchenOf(next);
  }
  const lookAgain = useRef(() => {});
  lookAgain.current = () => { if (document.visibilityState === "visible" && whyNow.current && !finding) void find(false).then((at) => at && follow(at)); };
  useEffect(() => {   // back from the phone's settings: a find that failed is made again, with no tap. A find that worked is not.
    if (lock !== "customer") return;
    const back = () => lookAgain.current();
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [lock]);
  useEffect(() => {
    if (lock !== "customer" || signedIn !== true || opened.current) return;
    opened.current = true;
    (async () => {
      const c = getClient();
      const [list, mark] = await Promise.all([listAddresses(c), placeMark(c).catch(() => false), listRecents(c).then(setRecents, () => undefined)]);
      const rows = list ?? [];
      if (list) { setSaved(list); savedNow.current = list; }
      marked.current = mark;
      if (rows.length > 0) markOnce();   // a saved address is a place confirmed once (customers from before the mark)
      else if (mark || whereNow.current) setKnown(true);
      if (!mark && rows.length === 0 && !whereNow.current) return;   // a new customer: the first-open screen, and the phone is asked on the tap
      // Story 1530: the screen does not wait for the find (up to 5 s). What is known shows now: the place on this phone, else the address used last (a row with no pin is skipped).
      const row = whereNow.current || held() ? null : lastUsed(rows.filter(hasPoint));
      if (row) useSaved(row, false);
      setAddrTried(true);
      const at = await find(false);   // one find by itself per app open; found, the place follows the phone
      if (at) return await follow(at);
      if (!held() && rows.length > 0) setSheet(true);
    })().catch(() => undefined).finally(() => setAddrTried(true));
  }, [signedIn]);   // eslint-disable-line react-hooks/exhaustive-deps
  async function saveNew(pl: { pin: string; address: string; label?: string; from?: Place; house?: string; landmark?: string }) {
    const row = await addAddress(getClient(), { label: pl.label || "Home", address: pl.address, pin: pl.pin, lat: pl.from?.lat ?? null, lng: pl.from?.lng ?? null, house: pl.house, landmark: pl.landmark });
    markOnce();   // story 1529: "Confirm & proceed" was tapped; the first-open screen never shows again
    if (row) { setSaved((cur) => [row, ...(cur ?? [])]); useSaved(row, false); }
    else choosePlace({ address: pl.address, pin: pl.pin, lat: pl.from?.lat ?? null, lng: pl.from?.lng ?? null, house: pl.house ?? "", landmark: pl.landmark ?? "", confirmed: !!pl.from, id: null });   // story 1532: the save failed; the place the customer confirmed stays, with its point
    setStep((s) => (s === "bill" ? "bill" : "menu"));   // "Confirm on the map" from the Bill comes back to the Bill
  }
  // Story 1530 (owner, 15 Nov 2026): a place picked from search and confirmed on the pin map is the place now and becomes a recent, never a saved address.
  // The recent holds the confirmed point, the customer's own words and a postal code that is ours (nearest_pin) or his (typed on the sheet): nothing of Ola's answer.
  function useSearched(a: Saved, s: Searched) {
    markOnce();
    choosePlace({ address: a.address, pin: a.pin, lat: a.from.lat, lng: a.from.lng, house: a.house, landmark: a.landmark, confirmed: true, id: null });
    setStep((st) => (st === "bill" ? "bill" : "menu"));
    void (async () => {
      const pin = (await nearestPin(a.from, undefined)) || (a.pinTyped ? a.pin : "");
      const row = await keepRecent(getClient(), recentsNow.current, { ...recentWords(s.typed, s.hit, a), pin, lat: a.from.lat, lng: a.from.lng, house: a.house, landmark: a.landmark });
      if (row) setRecents((cur) => [row, ...cur.filter((r) => r.id !== row.id)].slice(0, RECENTS_MAX));
    })().catch(() => undefined);
  }
  function pickRecent(r: Recent) {   // a recent is a confirmed place with its point; the tap makes it the newest
    const used_at = new Date().toISOString();
    choosePlace({ address: r.address, pin: r.pin, lat: r.lat, lng: r.lng, house: r.house, landmark: r.landmark, confirmed: true, id: null });
    setRecents((cur) => [{ ...r, used_at }, ...cur.filter((x) => x.id !== r.id)]);
    void touchRecent(getClient(), r.id);
    setFocusSearch(false); setPinMap(null); setSheet(false); setStep("menu");
  }
  async function saveEdit(id: string, a: { pin: string; address: string; label: string; from: Place; house: string; landmark: string }) {   // story #1051: the same row, the new words and the new pin
    const v = { label: a.label, address: a.address, pin: a.pin, lat: a.from.lat, lng: a.from.lng, house: a.house, landmark: a.landmark };
    if (!(await editAddress(getClient(), id, v))) return;
    setSaved((cur) => (cur ?? []).map((r) => (r.id === id ? { ...r, ...v } : r)));
    if (id === selectedId) choosePlace({ address: v.address, pin: v.pin, lat: v.lat, lng: v.lng, house: v.house, landmark: v.landmark, confirmed: true, id });   // story 1532: the picked address keeps its point after an edit
  }
  async function dropSaved(id: string) {
    if (!(await removeAddress(getClient(), id))) return;
    const rest = (savedNow.current ?? []).filter((r) => r.id !== id);
    setSaved(rest);
    const was = whereNow.current;
    if (id !== was?.id) return;
    const next = lastUsed(rest);
    if (next) return void useSaved(next, false);
    // Story 1529: the last address is gone. The customer stays on Deliver to, never the first-open screen: the place is where the phone is, or none (then the cart goes with the kitchen).
    const at = hereNow.current;
    const pin = at ? await nearestPin(at, undefined) : "";
    if (!at || !pin) return void changeArea();
    const here = herePlace(at, pin);
    if (!(await cartFits(was, here))) clearBill();   // review of PR 1539: the app chose this place, not the customer, so the cart of the old kitchen is not moved to another kitchen; story 1540: the menu says the bill was cleared
    choosePlace(here);
  }
  function changeArea() {
    setPlace(null);
    setArea(null);
    setMenu(null);
    clearBill();
  }
  const clearBill = () => { if (Object.values(cartNow.current).some((q) => q > 0)) setClosedNote(BILL_CLEARED_LINE); setCart({}); };   // story 1540: a bill is never cleared without a word

  // One tap for the kitchen and the rider: a status step or an event, sent as that role. The answer's updated_at decides which copy is newer.
  // Returns null when it worked, or the error code. The offline demo changes the local copy only and sends nothing.
  async function act(order: Order, action: { kind: "status"; to: string } | RiderAction, actor: "kitchen" | "rider", method?: DoorMethod): Promise<{ code: string; message: string } | null> {
    if (demo) {
      setOrders((cur) => mergeOrder(cur, { ...order, status: action.kind === "status" ? action.to : action.kind === "refused" ? "cancelled" : order.status, updated_at: new Date().toISOString(), ...(method ? { paid_by: method } : {}) }));
      if (action.kind === "event") setArrived((cur) => new Map(cur).set(order.id, cur.get(order.id) ?? new Date().toISOString()));
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
      const deps = { orderId: order.id };
      const { order: saved } = action.kind === "status" ? await changeStatus({ ...deps, to: action.to, method }, actDeps()) : await addEvent({ ...deps, event: action.event }, actDeps());
      setOrders((cur) => mergeOrder(cur, { ...order, status: saved.status, updated_at: saved.updated_at, paid_by: saved.paid_by ?? method ?? order.paid_by ?? null }));
      if (action.kind === "event") setArrived((cur) => new Map(cur).set(order.id, cur.get(order.id) ?? new Date().toISOString()));
      return null;
    } catch (e) {
      // "Already done" for Arriving means an earlier tap went through (the page may have been reloaded): that is success, not an error.
      if (e instanceof PlaceError && e.code === "already_done") {   // story 1262: for Delivered a second tap changes nothing; the first way it was paid stands
        if (action.kind === "event") setArrived((cur) => new Map(cur).set(order.id, cur.get(order.id) ?? new Date().toISOString()));
        if (action.kind === "status" && action.to === "delivered") {   // the first answer may have been lost: read the order again and show how it was really paid
          const { data } = await getClient().from("orders").select("id,status,updated_at,paid_by").eq("id", order.id);
          const row = (data as { id: string; status: string; updated_at: string; paid_by: string | null }[] | null)?.find((r) => r.id === order.id);
          if (row) setOrders((cur) => mergeOrder(cur, { ...order, status: row.status, updated_at: row.updated_at, paid_by: row.paid_by }));
        }
        return null;
      }
      if (e instanceof PlaceError && e.code === "method_off") loadRiderMethods();   // the setting changed under the rider: the UPI button and the QR go with it
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      pushTrail(`error: ${message}`);
      live.setError(message);
      return { code: e instanceof PlaceError ? e.code : "unknown", message };
    } finally {
      setBusyId(null);
    }
  }

  // Story #934: the kitchen declines a new order with a reason the customer reads. Returns null when it worked, or the error line.
  async function decline(order: Order, reason: string): Promise<string | null> {
    if (demo) { setOrders((cur) => mergeOrder(cur, { ...order, status: "cancelled", cancel_reason: reason, updated_at: new Date().toISOString() })); return null; }
    setBusyId(order.id);
    live.setError(null);
    pushTrail("kitchen: declined");
    try {
      const { order: saved } = await declineOrder({ orderId: order.id, reason }, actDeps());
      setOrders((cur) => mergeOrder(cur, { ...order, status: saved.status, cancel_reason: reason, updated_at: saved.updated_at }));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Something went wrong. Please try again.";
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
    setArrived(new Map());
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
        setArrived(new Map());
      }
    } else if (!navigator.onLine) startOffline();
    else setAuto(true);
  }


  // Story D2: the rider card appears once a rider has the order; the database answers only for this customer's own order.
  const [rider, setRider] = useState<RiderCard | null>(null);
  const riderStatus = tracked?.status;
  useEffect(() => {
    if (!placed || demo || (riderStatus !== "ready" && riderStatus !== "out_for_delivery")) return void setRider(null);
    let alive = true;
    void fetchRiderCard(placed.id).then((r) => { if (alive) setRider(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, [placed?.id, riderStatus, demo]);

  // Story #691 (boards T2, T3): On the way, the rider's place comes from the order_tracking row (read now, again on every realtime event and every 30 s, the ping rhythm).
  const [riderPoint, setRiderPoint] = useState<Tracked | null>(null);   // story 1497: the rider's place and the order's own drop point, both from the order's row
  const onTheWay = !!placed && !demo && riderStatus === "out_for_delivery";
  useEffect(() => {
    if (!onTheWay || !placed) return void setRiderPoint(null);
    const c = getClient();
    let alive = true;
    const read = () => void readRider(c, placed.id).then((p) => { if (alive && p) setRiderPoint(p); }).catch(() => undefined);   // a failed read keeps the last place
    read();
    const stop = watchRider(c, placed.id, read);
    const tick = setInterval(read, 30_000);
    return () => { alive = false; stop(); clearInterval(tick); };
  }, [placed?.id, onTheWay]);
  // Story #1015 (board E2a): the delivery time is the server's. Read now, again on every realtime event of the tracking row and every 30 s; a failed read keeps the last answer.
  const [eta, setEta] = useState<Eta | null>(null);
  const etaLive = !!placed && !demo && !!riderStatus && riderStatus !== "delivered" && riderStatus !== "cancelled";
  useEffect(() => {
    if (!etaLive || !placed) return void setEta(null);
    const c = getClient();
    let alive = true;
    const read = () => void readEta(c, placed.id).then((e) => { if (alive && e) setEta(e); }).catch(() => undefined);
    read();
    const stop = watchRider(c, placed.id, read, "eta");
    const tick = setInterval(read, 30_000);
    return () => { alive = false; stop(); clearInterval(tick); };
  }, [placed?.id, etaLive]);
  // Story 1507 (board ST1): when each step of this order happened. Read on open and again on each new status (every status writes its event first);
  // a failed read keeps the last known times. A reload, a second device or a week away reads the same rows.
  const [stepTimes, setStepTimes] = useState<{ id: string; at: StepTimes } | null>(null);
  const stepOrder = placed?.id ?? null, stepStatus = tracked?.status ?? null;
  useEffect(() => {
    if (!stepOrder || !stepStatus) return;   // a new status means a new event: read again
    let alive = true;
    void readStepTimes(getClient(), stepOrder).then((at) => { if (alive && at) setStepTimes({ id: stepOrder, at }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [stepOrder, stepStatus]);
  // Story #922: the rider tapped Arriving. Read now, again on every realtime event and every 30 s (a missed event heals itself); a reload or a second device reads it on open.
  const [atDoor, setAtDoor] = useState(false);
  useEffect(() => {
    if (!onTheWay || !placed) return void setAtDoor(false);
    const c = getClient();
    let alive = true;
    const read = () => void readArriving(c, placed.id).then((yes) => { if (alive && yes) setAtDoor(true); }).catch(() => undefined);   // a failed read keeps what is shown
    read();
    const stop = watchArriving(c, placed.id, read);
    const tick = setInterval(read, 30_000);
    return () => { alive = false; stop(); clearInterval(tick); };
  }, [placed?.id, onTheWay]);
  const riderTrack: Track | undefined = onTheWay && riderPoint ? { you: riderPoint.you, rider: riderPoint.rider, name: rider?.name ?? "Your rider", phone: rider?.phone ?? null } : undefined;

  // A tap on a slip of "Your orders" opens it as the tracker or the delivered screen (story H10d).
  function openOrder(o: Order) {
    setPlaced({ id: o.id, status: o.status, total_paise: o.total_paise, updated_at: o.updated_at, paid_by: o.paid_by ?? null });
    setPlacedAt(o.created_at);
    setStep("placed");
  }
  // Story #977: Order again puts a delivered order back in the cart at today's menu; what cannot go back is named, a closed kitchen adds nothing.
  const [againLine, setAgainLine] = useState<string | null>(null);
  useEffect(() => { if (step !== "bill" && step !== "orders") setAgainLine(null); }, [step]);
  function orderAgain(o: Order): boolean {   // true when the bill opened
    if (shown?.kind === "closed") { setAgainLine(`${kitchenName || "The kitchen"} is closed now. Try again when it opens.`); return false; }
    const { cart: next, left } = reorderCart(o.items, menu?.dishes ?? []);
    if (Object.keys(next).length === 0) { setAgainLine(left.length ? `${left.join(", ")} ${left.length === 1 ? "is" : "are"} not on the menu today.` : "Nothing from this order can be added today."); return false; }
    setCart(next);
    setAgainLine(left.length ? `${left.join(", ")} ${left.length === 1 ? "is" : "are"} not on the menu today.` : null);
    setError(null);
    setStep("bill");
    return true;
  }
  const openOrderNow = orders.find((o) => !["delivered", "cancelled"].includes(o.status));
  const openLive = openOrderNow ? { label: statusLabel(openOrderNow.status), no: shortId(openOrderNow.id), onOpen: () => openOrder(openOrderNow) } : null;
  // "Forget me on this phone": what this phone remembers is wiped and the session ends.
  async function forgetMe() {
    try { await getClient().auth.signOut(); } catch { /* offline: the local wipe still runs */ }
    try { window.localStorage.clear(); } catch { /* blocked storage: nothing to wipe */ }
    window.location.reload();
  }

  // Story #771 (Google Play): "Delete my account". The database function deletes this person's data and the login; then this phone is wiped like Forget me.
  // The toast is shown after the reload, so the flag waits in sessionStorage (localStorage is cleared).
  async function deleteAccount(): Promise<string | null> {
    const { data, error: failed } = await getClient().rpc("delete_my_account");
    if (failed) return "Could not delete the account. Check your connection and try again.";
    if (data && data.ok === false) return String(data.message ?? "Could not delete the account.");
    try { await getClient().auth.signOut(); } catch { /* the login is already gone on the server */ }
    try { window.localStorage.clear(); window.sessionStorage.setItem("gs-account-deleted", "1"); } catch { /* blocked storage: nothing to wipe */ }
    window.location.reload();
    return null;
  }
  useEffect(() => {
    try { if (window.sessionStorage.getItem("gs-account-deleted")) { window.sessionStorage.removeItem("gs-account-deleted"); setToast("Account deleted"); setTimeout(() => setToast(null), 4000); } } catch { /* blocked storage */ }
  }, []);

  const lines = useMemo(() => cartLines(cart, menu?.dishes ?? []), [cart, menu]);
  const kitchenName = area?.kind === "ok" ? area.kitchen.name : area?.kind === "closed" ? area.name : "";
  // Story #619, board L3: a dish the customer chose to swap goes to the server with swap true; the server puts its own alternative in its place.
  const [swapped, setSwapped] = useState<string[]>([]);
  // Story 1540: only the dishes on this kitchen's menu are sent (the rows the customer sees), never an id the cart still holds from another kitchen.
  const orderItems = useMemo(() => toOrderItems(Object.fromEntries(lines.map((l) => [l.dish.id, l.qty]))).map((i) => (swapped.includes(i.menu_item_id) ? { ...i, swap: true } : i)), [lines, swapped]);
  const offers = useOffers(lock === "customer" && step === "bill", area?.kind === "ok" ? area.kitchen.id : null, pin, orderItems, !OFFERS_ON);   // story #588; story #995: the quote is always asked on the Bill so the total is the server's; with the offers off it asks for no coupon
  const total = offers.quote ? offers.quote.to_pay_paise : cartTotal(lines);
  const dead = lines.find((l) => l.dish.available === false && !swapped.includes(l.dish.id));   // the first dish in the bill that is sold out
  const canSwap = OFFERS_ON;   // the swap is priced by POST /quote and ordered by POST /orders
  const takeOut = (id: string) => { setCart((c) => changeQty(c, id, -(c[id] ?? 0))); setSwapped((s) => s.filter((x) => x !== id)); };
  // No alternative (or no way to ask): the item goes out, the rest of the bill is kept, and the menu opens with the dish stamped Sold out.
  useEffect(() => {
    if (step !== "bill" || !dead) return;
    if (offers.alt === null || !canSwap) { takeOut(dead.dish.id); setStep("menu"); }
  }, [step, dead?.dish.id, offers.alt, canSwap]);   // eslint-disable-line react-hooks/exhaustive-deps
  // After a swap the Bill shows the lines the server priced: the new dish instead of the sold-out one.
  const count = lines.reduce((n, l) => n + l.qty, 0);
  // Story 1540: the ONE point where a cart meets another kitchen. Every change of place (a saved address, a recent, a search, the map, "Deliver here", an edit, a delete) ends in
  // a kitchen and its menu; when that menu is of another kitchen than the one the cart was read against, the cart moves to the new kitchen's own dishes and the customer is told:
  // the Bill's notice line, the old price struck on each changed row, and a dish the kitchen does not make as a struck row with "Take it out". Away from the Bill the menu says it.
  const [moved, setMoved] = useState<{ was: Record<string, number>; gone: Held[] } | null>(null);
  const cartMenu = useRef<{ id: string; dishes: Dish[] } | null>(null);   // the kitchen and the menu the cart was last read against
  useEffect(() => {
    if (lock !== "customer" || !menu?.kitchen || menu.kitchen !== areaKitchenId) return;
    const old = cartMenu.current;
    cartMenu.current = { id: menu.kitchen, dishes: menu.dishes };
    if (!old || old.id === menu.kitchen) return;
    const held = [...cartLines(cart, old.dishes).map((l) => ({ id: l.dish.id, name: l.dish.name, qty: l.qty, price_paise: l.dish.price_paise, veg: l.dish.veg })), ...(moved?.gone ?? [])];
    if (held.length === 0) return;
    const next = moveCart(held, menu.dishes), onBill = stepNow.current === "bill";
    setCart(next.cart);
    setMoved({ was: next.was, gone: onBill ? next.gone : [] });
    if (!onBill) setClosedNote(kitchenChangedLine(next.gone.map((g) => g.name)));
  }, [menu, areaKitchenId]);
  useEffect(() => { if (moved && count === 0 && moved.gone.length === 0) setMoved(null); }, [moved, count]);   // the bill is empty (ordered, or all taken out): nothing is left to say
  useEffect(() => { if (step !== "bill") setMoved((m) => (m?.gone.length ? { ...m, gone: [] } : m)); }, [step]);   // the rows to take out are the Bill's; leaving it lets them go
  const goneLines: Line[] = (moved?.gone ?? []).map((g) => ({ dish: { id: g.id, name: g.name, price_paise: g.price_paise, image_url: null, image_credit: null }, qty: g.qty, line_paise: g.price_paise * g.qty, gone: true }));
  const billLines: Line[] = [...(offers.quote?.swaps?.length && offers.quote.lines
    ? offers.quote.lines.map((l) => ({ dish: { id: l.menu_item_id, name: l.name, price_paise: l.unit_paise, image_url: null, image_credit: null }, qty: l.qty, line_paise: l.line_paise }))
    : lines.map((l) => (moved?.was[l.dish.id] !== undefined ? { ...l, was_paise: moved.was[l.dish.id] * l.qty } : l))), ...goneLines];
  const notMade = goneLines[0]?.dish;

  const [cancelling, setCancelling] = useState(false);
  // The customer cancels until cooking starts: placed or accepted (stories B3, #904). The database checks the rule; the live list brings the new status.
  async function cancelOrder() {
    if (!placed) return;
    setCancelling(true);
    setConfirmError(null);
    const { data, error: failed } = await getClient().rpc("cancel_order", { p_order: placed.id, p_reason: null });
    if (failed) { setConfirmError(cancelLine(failed.message)); capture("cancel_failed", { error: failed.message?.split(":")[0] ?? "unknown" }); }
    else if (data?.order) setOrders((cur) => mergeOrder(cur, data.order as Order));
    setCancelling(false);
  }

  useEffect(() => {
    if (!gate && !wall) return;
    let alive = true;
    ensureSession().then(() => getClient().auth.getUser()).then(({ data }) => {
      const p = data.user && !data.user.is_anonymous ? data.user.phone : null;
      const n = (data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name) as string | undefined;
      if (alive) setSignedIn(!!data.user && !data.user.is_anonymous);
      const m = data.user && !data.user.is_anonymous ? data.user.user_metadata : null;
      const url = String(m?.avatar_url ?? m?.picture ?? "");
      if (alive) setPhoto(/^https:\/\//.test(url) ? url : null);
      if (alive) setEmail(data.user && !data.user.is_anonymous ? data.user.email ?? null : null);
      if (alive && p) { setVerified(true); setPhone(p.replace(/^91/, "")); setSavedPhone(p.replace(/^91/, "")); if (n) setName((cur) => cur || n); }
      if (alive && n && data.user && !data.user.is_anonymous) setSignInName(n);   // story 1417: the sign-in name goes on the kitchen ticket and the rider card
    }).catch(() => { if (alive) setSignedIn(false); });
    return () => { alive = false; };
  }, [gate, wall]);

  async function demoKitchenId(): Promise<string | null> {
    const { data } = await getClient().from("kitchens").select("id").eq("active", true).eq("open", true).limit(1);
    return (data?.[0] as { id?: string } | undefined)?.id ?? null;
  }

  async function place() {
    if (lock && lock !== "customer") return;   // story H2: only the customer app and the demo console place orders
    // Story 1417 (issue text; the reviewer asks the owner for the switch-on case): checkout never opens the number, code or name sheet. The phone is the Bill's field.
    // The switch and OtpSheet stay: the welcome wall uses them. The Bill is the one caller of this function (tests/unit/place.test.ts).
    const drop = pointOf(where);
    if (!drop) return void setError(CONFIRM_PLACE_LINE);   // story 1532: no order leaves without a confirmed point (the Bill's button already waits)
    pushTrail("place order");
    setSending(true);
    setError(null);
    try {
      const items = orderItems;
      const fingerprint = JSON.stringify([items, address.trim()]);
      if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: crypto.randomUUID() };
      await currentSession();   // the sign-in must exist before the order is sent
      if (lock === "customer" && !(await saveProfile(getClient(), await ensureSession(), { name: name.trim() || signInName, phone, address, pin }))) {   // the kitchen and the rider need the name and phone; place_order copies them
        setError("Could not save your details. Try again.");
        return;
      }
      if (lock === "customer") setSavedPhone(phone);   // story 1417: the next bill shows this phone on one line
      const kitchenId = areaKitchenId ?? (lock ? null : await demoKitchenId());   // the demo console has no area step: it orders from the first open kitchen
      if (!kitchenId) throw new Error("Choose where the food goes first.");   // story #940: the order is placed for a kitchen by POST /orders, as the signed-in user
      const { order, confirm } = await placeOrderV2({ kitchenId, pin: pin ?? where?.pin ?? "", items, address: address.trim(), key: keyRef.current.key, expectedPaise: total, code: offers.code, none: offers.none, drop, instructions: note }, v2Deps());
      setPlaced(order);
      capture("order_placed", { items_count: lines.length, phone_to_address_m: farM === null ? null : Math.round(farM) });   // story #1056, rule 10: how often the phone is far from the chosen address at an order
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
      setNote("");
      keyRef.current = null;
    } catch (e) {
      if (e instanceof PlaceError && e.code === "sold_out") setLiveTick((n) => n + 1);   // story #619: read the menu again, the Bill then names the dish
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
  const [incentive, setIncentive] = useState<Rates | null>(null);   // stories 1443 and 1438: read at open; a failed read shows no row, never a guess
  const riderLive = role === "rider" && !demo;
  useEffect(() => {
    if (!riderLive) return;
    let alive = true;
    const read = () => void readRates(getClient()).then((r) => { if (alive && r) setIncentive(r); });   // a failed re-read keeps the last values
    read();
    const back = () => { if (document.visibilityState === "visible") read(); };   // the rider keeps the page open all day: read again on coming back
    document.addEventListener("visibilitychange", back);
    return () => { alive = false; document.removeEventListener("visibilitychange", back); };
  }, [riderLive, orders.length]);   // and when an order comes or goes
  const [pastDays, setPastDays] = useState<number | "fail" | null>(null);   // story 1442: the admin's "Past days" number, read at open; a failed read says so on the list
  const loadPastDays = () => { setPastDays(null); readPastDays(getClient()).then(setPastDays, () => setPastDays("fail")); };
  useEffect(() => { if (riderLive) loadPastDays(); }, [riderLive]);   // once at open; Try again reads it again
  const riderNoKitchen = role === "rider" && !demo && !jobKitchenId && !live.loading;   // stories 1445 and 1440: no order yet, so the one active kitchen, if there is only one
  useEffect(() => {
    if (!riderNoKitchen) return;
    let alive = true;
    void fetchOnlyKitchen(getClient()).then((k) => { if (alive && k) setJobKitchen(k); });
    return () => { alive = false; };
  }, [riderNoKitchen]);
  // Story 1182 (board RY3): Arriving is saved on the server. A reload or a second phone reads it back, so the rider opens on step 3, not step 2.
  const outJobId = role === "rider" && !demo ? riderOrders(orders).find((o) => o.status === "out_for_delivery")?.id ?? null : null;
  useEffect(() => {
    if (!outJobId || arrived.has(outJobId)) return;
    let alive = true;
    void riderArrivingAt(getClient(), outJobId).then((at) => { if (alive && at) setArrived((cur) => new Map(cur).set(outJobId, cur.get(outJobId) ?? at)); });
    return () => { alive = false; };
  }, [outJobId]);   // read once per job in hand
  // Story 1262 (board R7): the ways to collect at the door that are on. null until the read answers; [] when it failed. The rider screen names no method until it has the answer.
  const [riderMethods, setRiderMethods] = useState<DoorMethod[] | null>(demo ? ["cash", "upi_door"] : null);
  const [riderQr, setRiderQr] = useState<string | null | undefined>(undefined);   // undefined: the read has not answered yet
  const loadRiderMethods = () => {
    if (demo) return;
    setRiderMethods(null); setRiderQr(undefined);
    void Promise.all([readRiderQr(getClient()), fetchDoorMethods(getClient())]).then(([q, m]) => { setRiderQr(q.ok ? q.url : null); setRiderMethods(q.ok ? m : []); });   // both answers land together; a failed QR read is the failed state, never "no QR"
  };
  const riderScreen = (gate: RiderGateState | null) => (
    <RiderScreen orders={orders} loading={live.loading} error={live.error} busyId={busyId} arrived={arrived}
      onAct={(o, a, method) => act(o, a, "rider", method)} methods={riderMethods} qrUrl={riderQr} onLoadMethods={loadRiderMethods} gate={gate} kitchen={jobKitchen} onAtDoor={(o, m) => { if (!demo) void riderAtDoor(getClient(), o.id, m); }}
      incentive={incentive} pastDays={demo ? 0 : pastDays} onRetryPastDays={loadPastDays}
      onChangePaid={async (o, m) => { const code = demo ? null : await riderChangePaid(getClient(), o.id, m); if (code === null) setOrders((cur) => cur.map((x) => (x.id === o.id ? { ...x, paid_by: m } : x))); return code; }} />
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
      onStep={(o, to) => act(o, { kind: "status", to }, "kitchen")} onDecline={decline} onHandover={handover} gate={gate} />
  );
  const kitchenView = lock === "kitchen" ? <KitchenGate>{kitchenScreen}</KitchenGate> : kitchenScreen(null);
  // Story #1056 (board SW2): the header keeps the chosen address; past 2 km from it the phone is far, and a strip offers "Deliver here" (the map at the phone, then the details).
  // Only the phone's place when location is already allowed and the saved lat and lng: no map call, no geocode, nothing asked.
  const chosen = (saved ?? []).find((r) => r.id === selectedId);
  const farM = here && chosen && chosen.lat !== null && chosen.lng !== null ? distanceM(here, { lat: chosen.lat, lng: chosen.lng }) : null;
  const far = farM !== null && farM > FAR_M && chosen ? { km: Math.round(farM / 1000), label: chosen.label, onHere: () => setPinMap({ center: here! }) } : null;
  // Story #1112 (TC 1.6): signed in, no pin yet and the saved addresses not answered: the first screen waits (a returning customer never sees N0). The wait ends when they answer or fail.
  const waitingForAddresses = lock === "customer" && signedIn === true && step !== "placed" && step !== "orders" && ((!pin && !addrTried) || (!!pin && area === null && !areaError));   // or the pin is known and the kitchen of that pin is still being found
  const needArea = lock === "customer" && step !== "placed" && step !== "orders" && !(pin && (area?.kind === "ok" || area?.kind === "closed"));
  const noPlace = known && needArea && !pin && !waitingForAddresses;   // story 1529: a customer who confirmed a place before and has none now (the last address deleted, a new phone, not found): Deliver to, never the first-open screen
  const deliverTo = (
    <DeliverToScreen focusSearch={focusSearch} forMap={pinMap?.center} list={saved ?? []} selectedId={selectedId} here={here} search={placeSearch}
      recents={recents} recentId={recentAt(recents, where)} onRecent={pickRecent}
      // Story 1530: a pick from search opens the map at the place's own point. Under a map that was not opened from search (Add new address, an edit) the pick only moves the pin.
      onPlace={(h, typed) => { setFocusSearch(false); setPinMap({ ...pinMap, center: { lat: h.lat, lng: h.lng }, follow: false, recent: !pinMap || pinMap.recent ? { typed, hit: h } : undefined }); }}
      onBack={pinMap ? () => setFocusSearch(false) : noPlace ? undefined : () => { setFocusSearch(false); setStep("menu"); }} current={where && isHere(where) ? `Pin code ${where.pin}` : null} why={why} finding={finding}
      onSelect={(id) => { const r = (saved ?? []).find((x) => x.id === id); if (r) { setFocusSearch(false); setPinMap(null); pickRow(r); } }}
      onUseLocation={() => { void find(true).then((at) => { if (at) { setFocusSearch(false); setPinMap({ center: at }); } }); }} onAddNew={() => { setFocusSearch(false); openAtStart(); }}
      onEditOnMap={(a) => { setFocusSearch(false); if (a.lat !== null && a.lng !== null) setPinMap({ center: { lat: a.lat, lng: a.lng }, edit: a }); else openAtStart(a); }} onRemove={dropSaved} />
  );
  // Story #667: with the phone code on, the first screen is the number and the code (or Google); nothing else shows before it.
  const customerView = wall && (signedIn === null || otpSetting === undefined) ? <div className="ui-pad"><Skeleton lines={3} /></div> : wall && signedIn === false ? (
    <OtpSheet welcome googleOnly={!gate} phone={phone} onClose={() => undefined}
      onVerified={(p) => { setPhone(p); setSavedPhone(p); setVerified(true); setSignedIn(true); }} />
  ) : pinMap && !focusSearch ? (
    <PinMapScreen center={pinMap.center} follow={pinMap.follow} edit={pinMap.edit} kicker={pinMap.edit ? `Editing ${pinMap.edit.label}` : undefined} confirmLabel={pinMap.edit ? "Save changes" : "Confirm & proceed"} onBack={() => { setFocusSearch(false); setPinMap(null); }} recent={!!pinMap.recent?.typed} onSearch={(at) => { setPinMap({ ...pinMap, center: at, follow: false }); setFocusSearch(true); }}
      onInvite={async (f) => { const err = await askArea(f.pin, f.at); if (err) return err; setAreaAsk("done"); setPinMap(null); setFarPick(f); return null; }}
      onSave={(a) => { const e = pinMap.edit, r = pinMap.recent; setPinMap(null); if (!e && needArea) setSettingUp(true); if (e) void saveEdit(e.id, a); else if (r?.typed) useSearched(a, r); else void saveNew(a); }} />
  ) : pinMap ? deliverTo : farPick ? (
    <NoKitchen address={farPick.address} ask={areaAsk} error={areaAskError} offerPaise={areaOffer} onTell={() => undefined}
      onChange={() => { const at = farPick.at; setFarPick(null); setAreaAsk("idle"); setPinMap({ center: at }); }} />
  ) : settingUp && !areaError && !(pin && area?.kind === "none") ? (   // a failed read or no kitchen here: the screens for those show at once
    <AreaScreen pin={pin} address={address} area={area} busy={looking} error={areaError} onPlace={() => undefined} onMap={() => undefined} onSearch={() => undefined}
      finding={{ leaving: !needArea, onLeft: () => setSettingUp(false) }} />
  ) : step === "deliver" || noPlace ? deliverTo : waitingForAddresses ? (
    <div className="ui-pad"><Skeleton lines={3} /></div>
  ) : needArea && !known && !alertsAsked && reminder === "ask" ? (   // story 1529: the alerts ask is part of the first open, so it goes by the same mark
    <AlertsAsk busy={askingAlerts} onTurnOn={() => void turnOnFirst()} onNotNow={markAsked} />
  ) : needArea && pin && area?.kind === "none" ? (
    <NoKitchen address={address} ask={areaAsk} error={areaAskError} offerPaise={areaOffer} onTell={() => void tellMeWhenWeCome()} onSaved={saved?.length ? () => setStep("deliver") : undefined}
      onChange={() => { const at = from; changeArea(); if (at) setPinMap({ center: at }); else openAtStart(); }} />
  ) : needArea ? (
    <AreaScreen pin={pin} address={address} area={area} busy={looking} error={areaError} onPlace={(pl) => choosePlace({ address: pl.address, pin: pl.pin, lat: null, lng: null, house: "", landmark: "", confirmed: false, id: null })}
      onMap={(at) => setPinMap({ center: at })} onSearch={() => { setFocusSearch(true); setPinMap({ center: mapStart(), follow: true, recent: { typed: "", hit: null } }); }} />
  ) : (
    <>
        {step === "menu" && (
          <MenuScreen dishes={menu?.dishes ?? null} fromCache={menu?.fromCache ?? false} slow={menu?.slow ?? false} error={menuError} onRetry={() => setMenuTry((n) => n + 1)}
            pin={pin} name={name} qty={cart} cartCount={count} cartTotal={total}
            kitchenName={kitchenName}
            openText={shown?.kind === "ok" ? openTill(shown.kitchen.closes_at) : ""}
            closed={shown?.kind === "closed" ? closedCopy(shown.opens_at, shown.paused === true) : null} closedNote={closedNote}
            tellMe={tellMe} tellMeError={tellMeError} onTellMe={tellMeWhenOpen}
            onAdd={(id) => setCart((c) => addDish(c, id))} onChange={(id, d) => setCart((c) => changeQty(c, id, d))} onOpenCart={() => { setError(null); setStep("bill"); }}
            onChangePin={() => setStep("deliver")} onOrders={() => setStep("orders")} address={isHere(where) ? "" : address} label={isHere(where) ? HERE : saved?.find((r) => r.id === selectedId)?.label ?? "Deliver to"} photo={photo} onProfile={() => setStep("account")} far={far} />
        )}
        {step === "orders" && <OrdersScreen orders={orders} loading={live.loading} kitchenName={kitchenName} onOpen={openOrder} onMenu={() => setStep("menu")} onAgain={orderAgain} againLine={againLine} />}
        {step === "account" && (
          <AccountScreen photo={photo} email={email} onGivenName={(n) => setName((v) => v || n)} name={name} phone={phone} address={address} pin={pin} onName={setName} onPhone={setPhone}
            alerts={reminder} onAlerts={toggleAlerts} alertsError={alertsError} live={openLive} onForget={forgetMe} onDeleteAccount={deleteAccount}
            onMenu={() => setStep("menu")} onAddresses={() => setStep("deliver")} onOrders={() => setStep("orders")} />
        )}
        {menu && step === "bill" && (
          <BillScreen notice={againLine} under={moved ? KITCHEN_CHANGED_BILL : null} note={note} onNote={setNote} lines={billLines} total={total} soldOut={dead && step === "bill" ? { id: dead.dish.id, name: dead.dish.name, alt: offers.alt, canSwap, onSwap: () => setSwapped((s) => [...s, dead.dish.id]), onRemove: () => takeOut(dead.dish.id) }
            : notMade ? { id: notMade.id, name: notMade.name, line: notMadeLine(notMade.name), alt: null, canSwap: false, onSwap: () => undefined, onRemove: () => setMoved((m) => m && { ...m, gone: m.gone.filter((g) => g.id !== notMade.id) }) } : undefined} offers={OFFERS_ON && offers.quote ? { quote: offers.quote, codeError: offers.codeError, onApply: offers.apply, onRemove: offers.remove } : undefined} kitchenName={kitchenName} pin={pin} address={address} confirmed={!!pointOf(where)} onChangePlace={() => setStep("deliver")} onConfirmPlace={confirmOnMap}
            details={lock === "customer" ? { phone, onPhone: setPhone, saved: savedPhone } : undefined}
            door={lock === "customer" ? { methods: doorMethods ?? [], value: doorValue, onChange: setDoorPick } : undefined} sending={sending} error={error}
            onBack={() => setStep("menu")} onPlace={place} />
        )}
        {step === "placed" && placed && (
          <PlacedScreen order={placed} status={tracked?.status ?? placed.status} paidBy={tracked?.paid_by ?? null} bill={tracked && "bill" in tracked ? tracked.bill : placed.bill}
            placedAt={tracked?.created_at ?? placedAt} kitchenName={kitchenName} pin={pin} kitchenPhone={area?.kind === "ok" ? area.kitchen.phone ?? null : null}
            lines={tracked && "items" in tracked ? tracked.items.map((i) => ({ name: i.name, qty: i.qty, paise: i.price_paise * i.qty })) : placedLines}
            address={tracked && "address" in tracked ? tracked.address : address.trim()}
            confirmedAt={tracked && tracked.status === "delivered" ? deliveredAt(tracked) : null} early={tracked && tracked.status === "delivered" ? earlyMin(tracked as Order) : null}
            declined={tracked && cancelKind(tracked) === "declined" ? { reason: (tracked as Order).cancel_reason ?? "", at: tracked.updated_at } : null}
            asking={asking} busy={confirming} error={confirmError}
            onYes={yes} onNotYet={notYetTap} pay={paidNow || payState || resumedOnline ? { state: paidNow ? "paid" : payState ?? "waiting", method: payMethod === "cod" ? "upi" : payMethod, startedAt: payState ? payStart : null, error: payError, onPay: payNow, onCash: payCash, onSimulate: () => void simulatePaid(import.meta.env.VITE_PAYMENTS_DEV_SECRET ?? "", payRef.current) } : undefined}
            onBack={() => setStep("menu")} onMenu={() => { setPlaced(null); setCart({}); setStep("menu"); }}
            onCancel={cancelOrder} cancelling={cancelling} rider={rider} atDoor={atDoor} times={stepTimes && placed && stepTimes.id === placed.id ? stepTimes.at : undefined} track={riderTrack} eta={eta} onCall={() => void tapCall(getClient(), placed.id)} />
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
      {sheet && step === "menu" && !pinMap && !needArea && (
        <LocationOffSheet list={saved ?? []} selectedId={selectedId} why={why ?? "ask"} busy={finding} onClose={() => setSheet(false)}
          onFind={() => { void find(true).then((at) => at && follow(at)); }}
          onPick={pickRow} onViewAll={() => { setSheet(false); setStep("deliver"); }} onSearch={() => { setSheet(false); setStep("deliver"); }} />
      )}
      {toast && <p role="status" className="otp-toast">{toast}</p>}
      {demo && <p role="status" className="notice"><strong>Offline demo</strong></p>}
      {!lock && <DemoBar autoOn={auto || demo} autoNote={autoNote} onAuto={toggleAuto} />}
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
