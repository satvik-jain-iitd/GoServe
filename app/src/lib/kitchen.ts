import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderBill } from "./orders";
// What the kitchen sees: the orders of this session, newest first, and the one button each order can have (story #49).
// The rider's steps (out for delivery, delivered) belong to story #50, so after Ready the kitchen has no button.
export type OrderLine = { menu_item_id: string; name: string; qty: number; price_paise: number; extras_paise?: number };
export type Order = {
  id: string; session_id: string; status: string; address: string; items: OrderLine[]; total_paise: number; created_at: string; updated_at: string; paid_by?: string | null; bill?: OrderBill | null;
  payment_method?: string | null; paid_at?: string | null;   // story #552: online orders wait for the payment
  customer_name?: string | null; customer_phone?: string | null;
  kitchen_id?: string; rider_id?: string | null; cash_handed_at?: string | null; delivered_at?: string | null; promised_at?: string | null; cancel_reason?: string | null; cancelled_by?: string | null; instructions?: string | null;
  drop_lat?: number | null; drop_lng?: number | null;   // story #1182: the customer's exact pin, when the order has one
};

export const shortId = (id: string): string => id.slice(0, 8);   // the order number the customer and the kitchen both say

const STEPS: Record<string, { to: string; label: string }> = {
  placed: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start" },
  preparing: { to: "ready", label: "Ready" },
};
export const nextStep = (status: string) => STEPS[status] ?? null;

// One label map for the kitchen, the rider and the customer tracker.
const LABELS: Record<string, string> = { placed: "Placed", accepted: "Accepted", preparing: "Cooking", ready: "Ready", out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled" };
/** Story #1017: who cancelled, from the recorded fact `cancelled_by`. customer: the customer's own change of mind (Cancelled). declined: the kitchen or an admin said no, in words (Declined). rider: refused at the door.
 *  A row from before the column existed is read from its text, once: the old customer text and no text are the customer's, a code is the rider's, any other words are the kitchen's. */
export type CancelKind = "customer" | "declined" | "rider" | null;
export const cancelKind = (o: { status: string; cancelled_by?: string | null; cancel_reason?: string | null }): CancelKind => {
  if (o.status !== "cancelled") return null;
  if (o.cancelled_by === "customer") return "customer";
  if (o.cancelled_by === "kitchen" || o.cancelled_by === "admin") return "declined";
  if (o.cancelled_by === "rider") return "rider";
  const why = o.cancel_reason?.trim();
  return !why || why === "cancelled by customer" ? "customer" : why === "refused_at_door" ? "rider" : "declined";
};
/** Story 1454 (board KC1): the kitchen's cancelled row says the word once: by the customer, or the kitchen's or admin's own reason. */
export const cancelLine = (o: { status: string; cancelled_by?: string | null; cancel_reason?: string | null }): string => {
  const kind = cancelKind(o);
  if (kind === "customer") return "Cancelled by the customer · stop cooking";
  const why = kind === "rider" ? "refused at the door" : o.cancel_reason?.trim().replace(/^cancell?ed\b[\s:·-]*/i, "");   // review of PR 1477: the rider's code in words
  return why ? `Cancelled · ${why} · stop cooking` : "Cancelled · stop cooking";
};
export const statusLabel = (status: string): string => LABELS[status] ?? status;
/** The staff apps (kitchen, admin) say "New" for a placed order; the customer sees "Placed". One place for the difference (H12). */
export const staffLabel = (status: string): string => (status === "placed" ? "New" : statusLabel(status));

const WITH_RIDER = ["out_for_delivery", "delivered", "cancelled"];   // not the kitchen's any more
export const kitchenOrders = (orders: Order[]): Order[] => orders.filter((o) => !WITH_RIDER.includes(o.status));

// Story H11 (#194): the Ink boards split the kitchen's work into New (placed), Cooking (accepted, preparing) and Ready (waiting for the rider).
// Oldest first: the kitchen cooks in the order the tickets came.
const oldestFirst = (a: Order, b: Order) => a.created_at.localeCompare(b.created_at);
export const newTickets = (orders: Order[]): Order[] => orders.filter((o) => o.status === "placed").sort(oldestFirst);
export const cookingTickets = (orders: Order[]): Order[] => orders.filter((o) => o.status === "accepted" || o.status === "preparing").sort(oldestFirst);
export const readyTickets = (orders: Order[]): Order[] => orders.filter((o) => o.status === "ready").sort(oldestFirst);
/** Story #230: a ticket the cook had on Cooking that turned cancelled stays a minute, stamped Cancelled, so the cook knows. `seen` = ids that were on Cooking. */
export const justCancelled = (orders: Order[], seen: Set<string>, now: Date, ms = 60_000): Order[] =>
  orders.filter((o) => o.status === "cancelled" && seen.has(o.id) && now.getTime() - Date.parse(o.updated_at) < ms).sort(oldestFirst);
export type Done = { status: string; updated_at: string; delivered_at?: string | null; total_paise: number; paid_by?: string | null; cash_handed_at?: string | null; rider_id?: string | null };
/** When the order was delivered (story 1448). updated_at moves on every later change (a Change, the night's hand-over); delivered_at is set once. Older rows have none. */
export const deliveredAt = (o: { updated_at: string; delivered_at?: string | null }): string => o.delivered_at ?? o.updated_at;
/** Story 1508 (board DL1): whole minutes the food came before the promise. Null when on time, late, under a minute early, or when either time is not known (never a guess). */
export const earlyMin = (o: { delivered_at?: string | null; promised_at?: string | null }): number | null => {
  if (!o.delivered_at || !o.promised_at) return null;
  const min = Math.floor((new Date(o.promised_at).getTime() - new Date(o.delivered_at).getTime()) / 60_000);
  return min >= 1 ? min : null;
};
export type Hours = { opens: string | null; closes: string | null };
/** The cash day a time belongs to (story #229). A kitchen that closes past midnight (closes before opens, "18:00" to "02:00") keeps the night in one day:
 *  the closing hours are rolled back before the date is read. Any other kitchen, or unknown hours, uses the calendar day. */
export const dayOf = (iso: string | Date, hours?: Hours | null): string => {
  const d = new Date(iso);
  if (hours?.opens && hours.closes && hours.closes < hours.opens) { const [h, m] = hours.closes.split(":").map(Number); d.setMinutes(d.getMinutes() - h * 60 - m); }
  return d.toDateString();
};
/** The orders delivered today, by the phone's clock, newest first (the rider's Today, the kitchen's done count). */
export const deliveredToday = <T extends Done>(orders: T[], now = new Date(), hours?: Hours | null): T[] =>
  orders.filter((o) => o.status === "delivered" && dayOf(deliveredAt(o), hours) === dayOf(now, hours))
    .sort((a, b) => deliveredAt(b).localeCompare(deliveredAt(a)));
export const hhmm = (iso: string): string => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
/** True when "HH:MM" now lies outside the opening hours; a kitchen open 18:00 to 02:00 crosses midnight. Unknown hours: never outside. */
export const outsideHours = (opens: string | null, closes: string | null, now: string): boolean => {
  if (!opens || !closes || opens === closes) return false;
  return opens < closes ? now < opens || now >= closes : now >= closes && now < opens;
};
/** "22:00:00" from the kitchens row to "22:00" for the screen. */
export const hhmmOf = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null);

// A live event and the answer to a tap can arrive in either order: the copy with the later updated_at wins.
// Moments are compared, not text: the same instant can be written with Z or +00:00.
// Story #601: once an order has a paid_by it keeps it. Three updates of one transaction share a moment, and the first of them (paid_by null) can arrive after the Yes answer.
export const mergeOrder = (orders: Order[], incoming: Order): Order[] => {
  const old = orders.find((o) => o.id === incoming.id);
  if (old && Date.parse(old.updated_at) > Date.parse(incoming.updated_at)) return orders;
  const next = old?.paid_by && !incoming.paid_by ? { ...incoming, paid_by: old.paid_by } : incoming;
  return [...orders.filter((o) => o.id !== incoming.id), next].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};

// ---- Story #50: the rider's buttons and the customer's progress list ----
export type RiderAction = { kind: "status"; to: string; label: string } | { kind: "event"; event: "order.arriving"; label: string } | { kind: "refused"; label: string };
export const riderActions = (status: string): RiderAction[] => {
  if (status === "ready") return [{ kind: "status", to: "out_for_delivery", label: "Pick up" }];
  if (status === "out_for_delivery") return [{ kind: "event", event: "order.arriving", label: "Arriving" }, { kind: "status", to: "delivered", label: "Delivered" }, { kind: "refused", label: "Not delivered" }];
  return [];
};
export const riderOrders = (orders: Order[]): Order[] => orders.filter((o) => o.status === "ready" || o.status === "out_for_delivery").sort((a, b) => a.created_at.localeCompare(b.created_at));   // oldest first: the job in hand is the one waiting longest

const FLOW = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered"];
export const trackerSteps = (status: string): { status: string; label: string; state: "done" | "current" | "todo" }[] => {
  const at = FLOW.indexOf(status);
  return FLOW.map((s, i) => ({ status: s, label: statusLabel(s), state: at < 0 || i > at ? "todo" : i === at ? "current" : "done" }));
};

// Story #229: the evening hand-over. The kitchen confirms a rider's cash; the rows are stamped cash_handed_at and leave "in hand" on both screens.
export const isCash = (o: Done): boolean => !o.paid_by || o.paid_by === "cash";
export const cashInHand = (today: Done[]): number => today.filter((o) => isCash(o) && !o.cash_handed_at).reduce((n, o) => n + o.total_paise, 0);
export const handedOver = (today: Done[]): number => today.filter((o) => isCash(o) && !!o.cash_handed_at).reduce((n, o) => n + o.total_paise, 0);
/** One line per rider with cash: what they hold from today, what they handed over today, and older cash never handed over (the rpc stamps that too, so the row must show it). */
export const cashByRider = <T extends Done>(today: T[], all: T[]): { rider_id: string; inHand: number; handed: number; older: number }[] => {
  const held = all.filter((o) => o.status === "delivered" && o.rider_id && isCash(o) && !o.cash_handed_at);
  return [...new Set([...today, ...held].filter((o) => o.rider_id && isCash(o)).map((o) => o.rider_id as string))]
    .map((rider_id) => { const own = today.filter((o) => o.rider_id === rider_id); return { rider_id, inHand: cashInHand(own), handed: handedOver(own), older: cashInHand(held.filter((o) => o.rider_id === rider_id && !today.includes(o))) }; });
};
export const confirmHandover = async (c: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> }, riderId: string): Promise<string | null> =>
  (await c.rpc("kitchen_handover", { p_rider: riderId })).error?.message ?? null;

// Story #231: how far the rider is, from their last location. Null when the location is older than ten minutes or either point is unknown.
type Point = { lat: number | null; lng: number | null };
const kmBetween = (a: Point, b: Point): number => {   // haversine
  const r = Math.PI / 180, dLat = (b.lat! - a.lat!) * r, dLng = (b.lng! - a.lng!) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
export const minutesAway = (rider: Point & { updated_at: string }, kitchen: Point, now = new Date(), speedKmh = 18, freshMs = 10 * 60_000): number | null => {
  if (rider.lat == null || rider.lng == null || kitchen.lat == null || kitchen.lng == null) return null;
  if (now.getTime() - Date.parse(rider.updated_at) > freshMs) return null;
  return Math.max(1, Math.round((kmBetween(rider, kitchen) / speedKmh) * 60));   // ponytail: one Delhi scooter speed (A64); a real ETA needs the road, not the crow
};
