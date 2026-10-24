// "Your orders" of the Ink v3 boards 08 and 08e (story H10d, #193; stories B3, D2): the slips of this phone, newest first. A tap opens the slip.
import { formatRupees } from "../lib/money";
import { shortId, statusLabel, type Order } from "../lib/kitchen";
import { orderSummary } from "../lib/profile";
import { Skeleton, TabBar } from "../ui";

const TAG: Record<string, string> = { placed: "placed", accepted: "placed", preparing: "", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "error" };
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const when = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `today ${hhmm(d)}`;
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${hhmm(d)}`;   // a 23:50 order seen at 00:10
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${hhmm(d)}`;
};

type Props = { orders: Order[]; loading: boolean; kitchenName: string; onOpen: (o: Order) => void; onMenu: () => void; onYou: () => void };

export function OrdersScreen({ orders, loading, kitchenName, onOpen, onMenu, onYou }: Props) {
  const empty = !loading && orders.length === 0;
  return (
    <>
      <header className="ui-head">
        <h1>Your orders</h1>
        <span className="meta">{orders.length} {orders.length === 1 ? "order" : "orders"}</span>
      </header>
      <div className={empty ? "ui-scroll ui-center" : "ui-scroll ui-orders"}>
        {loading && orders.length === 0 && <div className="ui-pad"><Skeleton lines={3} /></div>}
        {empty && (
          <div className="ui-empty">
            <h2>No orders yet</h2>
            <p className="ui-meta">Your orders show here, newest first. No sign-in needed.</p>
            <button type="button" className="ui-btn" onClick={onMenu}>See the menu</button>
          </div>
        )}
        {orders.map((o) => (
          <button key={o.id} type="button" className="ui-order-row" onClick={() => onOpen(o)}>
            <span className="ui-order-main">
              <span className="mono ui-order-no">No. {shortId(o.id)} · {when(o.created_at)}</span>
              <span className="ui-order-items">{orderSummary(o)}</span>
              <span className="ui-order-sub">{kitchenName ? `${kitchenName} · ` : ""}<span className="mono">{formatRupees(o.total_paise)}</span></span>
            </span>
            <span className={`ui-tag ${TAG[o.status] ?? ""}`}>{statusLabel(o.status)}</span>
          </button>
        ))}
        {orders.length > 0 && <p className="mono ui-foot">Newest first</p>}
      </div>
      <TabBar current="orders" onMenu={onMenu} onOrders={() => undefined} onYou={onYou} />
    </>
  );
}
