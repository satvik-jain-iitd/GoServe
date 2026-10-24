// What the kitchen sees: the orders of this session, newest first, and the one button each order can have (story #49).
// The rider's steps (out for delivery, delivered) belong to story #50, so after Ready the kitchen has no button.
export type OrderLine = { menu_item_id: string; name: string; qty: number; price_paise: number };
export type Order = {
  id: string; session_id: string; status: string; address: string; items: OrderLine[]; total_paise: number; created_at: string; updated_at: string; paid_by?: string | null;
  customer_name?: string | null; customer_phone?: string | null;
  kitchen_id?: string; rider_id?: string | null; cash_handed_at?: string | null;
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
export type Done = { status: string; updated_at: string; total_paise: number; paid_by?: string | null; cash_handed_at?: string | null; rider_id?: string | null };
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
  orders.filter((o) => o.status === "delivered" && dayOf(o.updated_at, hours) === dayOf(now, hours))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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
export const mergeOrder = (orders: Order[], incoming: Order): Order[] => {
  const old = orders.find((o) => o.id === incoming.id);
  if (old && Date.parse(old.updated_at) > Date.parse(incoming.updated_at)) return orders;
  return [...orders.filter((o) => o.id !== incoming.id), incoming].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
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
