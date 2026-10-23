// "My orders" (story B3, D2): what this customer ordered before, newest first, with Order again. No order ids: a customer says what they ate, not a number.
import { formatRupees } from "../lib/money";
import { statusLabel, type Order } from "../lib/kitchen";
import { orderSummary } from "../lib/profile";
import { AppBar, Button, Empty, Skeleton } from "../ui";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export function OrdersScreen({ orders, loading, onBack, onAgain }: { orders: Order[]; loading: boolean; onBack: () => void; onAgain: (o: Order) => void }) {
  return (
    <section>
      <AppBar title="My orders" onBack={onBack} />
      {loading && orders.length === 0 && <Skeleton lines={3} />}
      {!loading && orders.length === 0 && <Empty title="No orders yet" hint="Your orders will show here." />}
      <ul className="tickets">
        {orders.map((o) => (
          <li key={o.id} className="ticket">
            <div className="ticket-head"><strong>{when(o.created_at)}</strong><span className={`badge ${o.status}`}>{statusLabel(o.status)}</span></div>
            <p>{orderSummary(o)}</p>
            <p className="note">{formatRupees(o.total_paise)} · cash on delivery</p>
            <Button variant="ghost" onClick={() => onAgain(o)}>Order again</Button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={onBack}>Back to menu</Button>
    </section>
  );
}
