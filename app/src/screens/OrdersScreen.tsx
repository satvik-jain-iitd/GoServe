// "My orders" (story B3): what this customer ordered before, newest first. No order ids: a customer says what they ate, not a number.
import { formatRupees } from "../lib/money";
import { statusLabel, type Order } from "../lib/kitchen";
import { orderSummary } from "../lib/profile";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export function OrdersScreen({ orders, loading, onBack }: { orders: Order[]; loading: boolean; onBack: () => void }) {
  return (
    <section>
      <h2>My orders</h2>
      {loading && orders.length === 0 && <p>Loading your orders…</p>}
      {!loading && orders.length === 0 && <p>No orders yet.</p>}
      <ul className="tickets">
        {orders.map((o) => (
          <li key={o.id} className="ticket">
            <div className="ticket-head"><strong>{when(o.created_at)}</strong><span className={`badge ${o.status}`}>{statusLabel(o.status)}</span></div>
            <p>{orderSummary(o)}</p>
            <p className="note">{formatRupees(o.total_paise)} · cash on delivery</p>
          </li>
        ))}
      </ul>
      <button type="button" className="btn ghost" onClick={onBack}>Back to menu</button>
    </section>
  );
}
