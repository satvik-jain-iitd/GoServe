// "History" of the Ink v3 boards 08 and 08e (story H10d, #193), as the owner picked in story 1589 (frame history-1): the orders grouped by kitchen, a row with the dishes,
// the time and the price, a chevron, no tag and no button. Only an exception is a word. A tap opens the order; Order it again lives there.
import { useState } from "react";
import { clock12 } from "../lib/clock";
import { formatRupees } from "../lib/money";
import { cancelKind, statusLabel, type Order } from "../lib/kitchen";
import { Skeleton, TabBar } from "../ui";

const when = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `today ${clock12(d)}`;
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${clock12(d)}`;   // a 23:50 order seen at 00:10
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const dishes = (o: Order) => o.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(", ");
const CHEVRON = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>;
const DOWN = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>;
const SHORT = 3;   // story 1637: a card shows its three newest orders until the customer taps "View all"

// The kitchen that cooks for the place now comes first; the others follow, the one with the newest order first; orders with no kitchen sit last under "Older orders".
function groups(orders: Order[], now: string | null) {
  const by = new Map<string, Order[]>();
  for (const o of [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))) by.set(o.kitchen_id ?? "", [...(by.get(o.kitchen_id ?? "") ?? []), o]);
  const rank = (id: string) => (id === now ? 0 : id === "" ? 2 : 1);
  return [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));   // a stable sort keeps the newest-first order among the others
}

type Props = { orders: Order[]; loading: boolean; kitchenName: string; kitchenId: string | null; kitchenNames: Record<string, string>; onOpen: (o: Order) => void; onMenu: () => void };

export function OrdersScreen({ orders, loading, kitchenName, kitchenId, kitchenNames, onOpen, onMenu }: Props) {
  const empty = !loading && orders.length === 0;
  const [open, setOpen] = useState<string[]>([]);   // the kitchens the customer opened on this visit; not saved anywhere
  return (
    <>
      <header className="ui-head">
        <h1>History</h1>
      </header>
      <div className={empty ? "ui-scroll ui-center" : "ui-scroll ui-orders"}>
        {loading && orders.length === 0 && <div className="ui-pad"><Skeleton lines={3} /></div>}
        {empty && (
          <div className="ui-empty">
            <h2>No orders yet</h2>
            <p className="ui-meta">Your orders will show here.</p>
            <button type="button" className="ui-btn" onClick={onMenu}>See the menu</button>
          </div>
        )}
        {groups(orders, kitchenId).map(([id, list]) => {
          const name = id ? kitchenNames[id] ?? (id === kitchenId ? kitchenName : "Another kitchen") : "Older orders";
          const shown = open.includes(id) || list.length <= SHORT ? list : list.slice(0, SHORT);
          return (
          <section key={id} className="ui-saved-card ui-order-card" aria-label={name}>
            <h2 className="ui-order-group">
              <b>{name}</b>
              {id && <span>{id === kitchenId ? "cooks for you now" : "your older orders"}</span>}
            </h2>
            {shown.map((o) => {
              const bad = o.status === "cancelled";
              const word = bad ? (cancelKind(o) === "declined" ? "Declined" : "Cancelled") : o.status === "delivered" ? "" : statusLabel(o.status);   // story #1172: a cancelled or declined order owes nothing, so no price
              return (
                <button key={o.id} type="button" className="ui-order-row" onClick={() => onOpen(o)}>
                  <span className="ui-order-main">
                    <span className="ui-order-items">{dishes(o)}</span>
                    <span className="ui-order-sub">{when(o.created_at)}{word && <> · <span className={`ui-order-word${bad ? " bad" : ""}`}>{word}</span></>}{!bad && <> · <span className="mono">{formatRupees(o.total_paise)}</span></>}</span>
                  </span>
                  {CHEVRON}
                </button>
              );
            })}
            {!open.includes(id) && list.length > SHORT && (
              <button type="button" className="ui-view-all" aria-label={"View all orders of " + name} onClick={() => setOpen([...open, id])}>View all {DOWN}</button>
            )}
          </section>
          );
        })}
      </div>
      <TabBar current="orders" onMenu={onMenu} onOrders={() => undefined} />
    </>
  );
}
