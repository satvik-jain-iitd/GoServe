// "Your orders" of the Ink v3 boards 08 and 08e (story H10d, #193; stories B3, D2): the slips of this phone, newest first. A tap opens the slip.
import { clock12 } from "../lib/clock";
import { formatRupees } from "../lib/money";
import { isDeclined, shortId, statusLabel, type Order } from "../lib/kitchen";
import { orderSummary } from "../lib/profile";
import { Skeleton, TabBar } from "../ui";

const TAG: Record<string, string> = { placed: "placed", accepted: "placed", preparing: "", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "error" };
const when = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `today ${clock12(d)}`;
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${clock12(d)}`;   // a 23:50 order seen at 00:10
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${clock12(d)}`;
};

type Props = { orders: Order[]; loading: boolean; kitchenName: string; onOpen: (o: Order) => void; onMenu: () => void; onAgain: (o: Order) => void; againLine: string | null };

export function OrdersScreen({ orders, loading, kitchenName, onOpen, onMenu, onAgain, againLine }: Props) {
  const empty = !loading && orders.length === 0;
  return (
    <>
      <header className="ui-head">
        <h1>History</h1>
        <span className="meta">Order again · today&apos;s prices</span>
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
        {againLine && <p role="status" className="ui-note ui-again-line">{againLine}</p>}
        {orders.map((o) => (
          <div key={o.id} className="ui-order-row ui-order-row-wrap">
            <button type="button" className="ui-order-main ui-order-open" onClick={() => onOpen(o)}>
              <span className="mono ui-order-no">No. {shortId(o.id)} · {when(o.created_at)}</span>
              <span className="ui-order-items">{orderSummary(o)}</span>
              <span className="ui-order-sub">{kitchenName ? `${kitchenName} · ` : ""}<span className="mono">{formatRupees(o.total_paise)}</span></span>
              {isDeclined(o) && <span className="ui-order-sub">{kitchenName || "The kitchen"} could not take this order.</span>}
            </button>
            <span className="ui-order-side">
              <span className={`ui-tag ${TAG[o.status] ?? ""}`}>{isDeclined(o) ? "Declined" : statusLabel(o.status)}</span>
              {o.status === "delivered" && <button type="button" className="ui-btn ghost small" aria-label={`Order again, No. ${shortId(o.id)}`} onClick={() => onAgain(o)}>Order again</button>}
            </span>
          </div>
        ))}
        {orders.length > 0 && <p className="mono ui-foot">Newest first</p>}
      </div>
      <TabBar current="orders" onMenu={onMenu} onOrders={() => undefined} />
    </>
  );
}
