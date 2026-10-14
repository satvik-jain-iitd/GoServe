import { riderActions, shortId, statusLabel, type Order, type RiderAction } from "../lib/kitchen";
import { formatRupees } from "../lib/money";

type Props = { orders: Order[]; loading: boolean; error: string | null; busyId: string | null; arrived: Set<string>; onAct: (order: Order, action: RiderAction) => void };

export function RiderScreen({ orders, loading, error, busyId, arrived, onAct }: Props) {
  return (
    <section>
      <h2>Rider</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {loading && <p>Loading deliveries…</p>}
      {!loading && orders.length === 0 && !error && <p>No deliveries yet.</p>}
      <ul className="tickets">
        {orders.map((o) => (
          <li key={o.id} className="ticket">
            <div className="ticket-head">
              <strong>Order {shortId(o.id)}</strong>
              <span className={`badge ${o.status}`}>{statusLabel(o.status)}</span>
            </div>
            <p className="note">{o.address}</p>
            <p className="note">Collect {formatRupees(o.total_paise)} (pay on delivery)</p>
            <div className="actions">
              {riderActions(o.status).map((a) => (
                <button key={a.label} type="button" className="btn" aria-label={`${a.label} ${shortId(o.id)}`}
                  disabled={busyId === o.id || (a.kind === "event" && arrived.has(o.id))} onClick={() => onAct(o, a)}>
                  {a.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
